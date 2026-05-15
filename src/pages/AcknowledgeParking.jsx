import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const finalStatuses = [
  "Removed",
  "Closed",
  "Closed - Claimed",
  "Closed - Not Abandoned",
];

const monthlyStartingCompliancePoints = 100;
const monthlyRecoveryPoints = 10;

const normalizePhoneNumber = (phoneNumber) =>
  phoneNumber.replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "");

const getWarningLabel = (warningNumber) => {
  if (warningNumber === 1) return "1st warning";
  if (warningNumber === 2) return "2nd warning";
  if (warningNumber === 3) return "3rd warning";

  return `${warningNumber}th warning`;
};

const getOffenceDeduction = (offenceNumber) => {
  if (offenceNumber === 1) return 5;
  if (offenceNumber === 2) return 10;

  return Math.min(15 + (offenceNumber - 3) * 5, 30);
};

const getAcknowledgedStatus = (offenceNumber) => {
  if (offenceNumber === 1) return "Acknowledged - 1st Warning";
  if (offenceNumber === 2) return "Acknowledged - 2nd Warning";

  return "Acknowledged - Repeated Offence";
};

const getRecoveryPointsSinceLastOffence = (latestSubmittedAt) => {
  if (!latestSubmittedAt) return 0;

  const latestDate = new Date(latestSubmittedAt);

  if (Number.isNaN(latestDate.getTime())) return 0;

  const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60 * 1000;
  const monthsWithoutOffence = Math.floor(
    (Date.now() - latestDate.getTime()) / thirtyDaysInMilliseconds
  );

  return Math.max(monthsWithoutOffence, 0) * monthlyRecoveryPoints;
};

function AcknowledgeParking() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportSnap = await getDoc(doc(db, "reports", id));

        if (reportSnap.exists()) {
          setReport({
            id: reportSnap.id,
            ...reportSnap.data(),
          });
        }
      } catch (error) {
        console.error("Error fetching improper parking notice:", error);
        setMessage({
          type: "danger",
          text: "Unable to load this notice right now. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  const isImproperParking = report?.caseType === "improperParking";
  const isFinalStatus = finalStatuses.includes(report?.status);
  const alreadyAcknowledged = report?.status?.startsWith("Acknowledged");

  const getPriorComplianceState = async (phoneNumber) => {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const responseMap = new Map();
    const lookupQueries = [
      query(
        collection(db, "reports"),
        where("acknowledgementPhoneNormalized", "==", normalizedPhone)
      ),
      query(
        collection(db, "reports"),
        where("acknowledgementPhone", "==", phoneNumber)
      ),
    ];

    if (normalizedPhone !== phoneNumber) {
      lookupQueries.push(
        query(
          collection(db, "reports"),
          where("acknowledgementPhone", "==", normalizedPhone)
        )
      );
    }

    const responseSnapshots = await Promise.all(
      lookupQueries.map((lookupQuery) => getDocs(lookupQuery))
    );

    responseSnapshots.forEach((responseSnapshot) => {
      responseSnapshot.docs.forEach((docItem) => {
        responseMap.set(docItem.id, docItem.data());
      });
    });

    const priorEntries = [];

    responseMap.forEach((responseReport) => {
      if (responseReport.responseHistory?.length > 0) {
        priorEntries.push(
          ...responseReport.responseHistory.filter((response) => {
            const responsePhone = response.phoneNormalized || response.phone || "";

            return normalizePhoneNumber(responsePhone) === normalizedPhone;
          })
        );
        return;
      }

      priorEntries.push({
        compliancePoints:
          responseReport.compliancePoints ?? monthlyStartingCompliancePoints,
        submittedAt: responseReport.acknowledgedAt?.toDate
          ? responseReport.acknowledgedAt.toDate().toISOString()
          : responseReport.acknowledgedAt || "",
      });
    });

    const sortedEntries = priorEntries.sort((firstEntry, secondEntry) => {
      const firstDate = new Date(firstEntry.submittedAt || 0).getTime();
      const secondDate = new Date(secondEntry.submittedAt || 0).getTime();

      return firstDate - secondDate;
    });
    const latestEntry = sortedEntries[sortedEntries.length - 1];

    return {
      priorOffenceCount: sortedEntries.length,
      previousCompliancePoints:
        latestEntry?.compliancePoints ?? monthlyStartingCompliancePoints,
      latestSubmittedAt: latestEntry?.submittedAt || "",
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!report || !isImproperParking || isFinalStatus || alreadyAcknowledged) {
      setMessage({
        type: "warning",
        text: "This notice is no longer accepting acknowledgements.",
      });
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const normalizedPhone = normalizePhoneNumber(trimmedPhone);
    const trimmedNotes = notes.trim();

    if (!trimmedName || !normalizedPhone) {
      setMessage({
        type: "danger",
        text: "Please provide your name and phone number.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const priorComplianceState = await getPriorComplianceState(trimmedPhone);
      const currentReportHistoryCount = report.responseHistory?.length || 0;
      const warningNumber = Math.max(
        priorComplianceState.priorOffenceCount + 1,
        currentReportHistoryCount + 1
      );
      const warningLabel = getWarningLabel(warningNumber);
      const pointsDeducted = getOffenceDeduction(warningNumber);
      const recoveryPointsApplied = getRecoveryPointsSinceLastOffence(
        priorComplianceState.latestSubmittedAt
      );
      const recoveredPreviousCompliancePoints = Math.min(
        priorComplianceState.previousCompliancePoints + recoveryPointsApplied,
        monthlyStartingCompliancePoints
      );
      const compliancePoints = Math.max(
        recoveredPreviousCompliancePoints - pointsDeducted,
        0
      );
      const totalPointsDeducted =
        monthlyStartingCompliancePoints - compliancePoints;
      const enforcementReviewRequired = compliancePoints === 0;
      const responseEntry = {
        name: trimmedName,
        phone: trimmedPhone,
        phoneNormalized: normalizedPhone,
        unit: "",
        notes: trimmedNotes,
        warningLevel: warningLabel,
        warningNumber,
        previousCompliancePoints: priorComplianceState.previousCompliancePoints,
        recoveryPointsApplied,
        recoveredPreviousCompliancePoints,
        compliancePoints,
        pointsDeducted,
        totalPointsDeducted,
        monthlyStartingCompliancePoints,
        monthlyRecoveryPoints,
        enforcementReviewRequired,
        submittedAt: new Date().toISOString(),
      };
      const responseHistory = [
        ...(report.responseHistory || []),
        responseEntry,
      ];

      await updateDoc(doc(db, "reports", id), {
        status: getAcknowledgedStatus(warningNumber),
        acknowledgementName: trimmedName,
        acknowledgementPhone: trimmedPhone,
        acknowledgementPhoneNormalized: normalizedPhone,
        acknowledgementUnit: "",
        acknowledgementNotes: trimmedNotes,
        acknowledgedAt: serverTimestamp(),
        warningLevel: warningLabel,
        warningNumber,
        offencePointsDeducted: pointsDeducted,
        compliancePoints,
        compliancePointsDeducted: totalPointsDeducted,
        monthlyStartingCompliancePoints,
        monthlyRecoveryPoints,
        recoveryPointsApplied,
        enforcementReviewRequired,
        enforcementReviewReason: enforcementReviewRequired
          ? "Compliance score reached 0 due to repeated non-compliance."
          : "",
        responseHistory,
        updatedAt: serverTimestamp(),
      });

      navigate(`/qr/${id}`);
    } catch (error) {
      console.error("Error submitting acknowledgement:", error);
      setMessage({
        type: "danger",
        text: "Unable to submit your acknowledgement right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="portal-card">
        <h1 className="fw-bold mb-4">
          Acknowledge Improper Parking Notice
        </h1>

        <p className="text-muted fs-5">
          Submit this acknowledgement if the bicycle belongs to you. A warning
          and compliance points record will be saved automatically.
        </p>

        {loading ? (
          <div className="alert alert-info">Loading notice...</div>
        ) : !report ? (
          <div className="alert alert-danger">Notice not found.</div>
        ) : !isImproperParking ? (
          <div className="alert alert-warning">
            This notice is not an improper parking case.
          </div>
        ) : isFinalStatus || alreadyAcknowledged ? (
          <div className="alert alert-success">
            This acknowledgement has already been recorded.
          </div>
        ) : (
          <>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="border rounded-3 p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Block
                  </p>
                  <p className="fw-semibold mb-0">
                    {report.blockNumber || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="border rounded-3 p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Location
                  </p>
                  <p className="fw-semibold mb-0">
                    {report.location || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="col-12">
                <div className="border rounded-3 p-3">
                  <p className="text-muted small text-uppercase mb-1">
                    Current Compliance Points
                  </p>
                  <p className="fw-semibold mb-2">
                    {report.compliancePoints ?? monthlyStartingCompliancePoints}/100
                  </p>
                  <p className="mb-0">
                    Residents start with 100/100 compliance points.
                    First offences deduct 5 points, second offences deduct 10
                    points, and repeated offences deduct more. Residents can
                    recover 10 points monthly when no offences are recorded.
                  </p>
                </div>
              </div>
            </div>

            {message && (
              <div className={`alert alert-${message.type}`} role="alert">
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="ownerName">
                    Your Name
                  </label>
                  <input
                    className="form-control"
                    id="ownerName"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="ownerPhone">
                    Phone Number
                  </label>
                  <input
                    className="form-control"
                    id="ownerPhone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="acknowledgementNotes">
                    Response Notes
                  </label>
                  <textarea
                    className="form-control"
                    id="acknowledgementNotes"
                    rows="4"
                    placeholder="Example: I acknowledge the warning and will move the bicycle away from the obstruction."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <button
                className="btn btn-warning mt-4"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Acknowledgement"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default AcknowledgeParking;
