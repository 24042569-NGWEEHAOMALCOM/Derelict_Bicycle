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

const normalizePhoneNumber = (phoneNumber) =>
  phoneNumber.replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "");

const isClosedStatus = (status) =>
  status === "Closed" || status?.startsWith("Closed -");

const getWarningLabel = (warningNumber) => {
  if (warningNumber === 1) return "1st warning";
  return "2nd warning";
};

const getAcknowledgedStatus = (offenceNumber) => {
  if (offenceNumber === 1) return "Acknowledged - 1st Warning";
  return "Acknowledged - 2nd Warning";
};

const getWarningNoticeCopy = (warningNumber, hasPhoneNumber) => {
  if (warningNumber >= 2) {
    return {
      title: "2nd Warning for Improper Parking",
      body:
        "This bicycle has been locked by the Town Council due to repeated improper parking offences.",
      instruction:
        "Please proceed to the Town Council office for verification and assistance.",
    };
  }

  if (!hasPhoneNumber) {
    return {
      title: "Improper Parking Warning",
      body:
        "Enter your phone number below to verify whether this notice is a 1st or 2nd warning." ,
      instruction:
        "If this is a 2nd warning, the bicycle has been locked by Town Council."
    };
  }

  return {
    title: "1st warning for improper parking",
    body:
      "Please move your bicycle away from this location and park it properly.",
    instruction:
      "If this bicycle commits a 2nd improper parking offence, it will be locked by Town Council." +
      "You will be required to head down to the Town Council office for assistance.",
  };
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
  const [previewWarningNumber, setPreviewWarningNumber] = useState(1);

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
  const currentWarningNumber = Math.max(
    previewWarningNumber,
    Number(report?.warningNumber) || 1
  );
  const hasPhoneNumber = Boolean(normalizePhoneNumber(phone));
  const warningNoticeCopy = getWarningNoticeCopy(
    currentWarningNumber,
    hasPhoneNumber
  );

  const getPriorWarningState = async (phoneNumber) => {
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

    const priorWarnings = [];

    responseMap.forEach((responseReport) => {
      if (isClosedStatus(responseReport.status)) {
        return;
      }

      if (responseReport.responseHistory?.length > 0) {
        priorWarnings.push(
          ...responseReport.responseHistory.filter((response) => {
            const responsePhone = response.phoneNormalized || response.phone || "";

            return normalizePhoneNumber(responsePhone) === normalizedPhone;
          })
        );
        return;
      }

      priorWarnings.push(responseReport);
    });

    return {
      priorOffenceCount: priorWarnings.length,
    };
  };

  useEffect(() => {
    const updatePreviewWarning = async () => {
      const normalizedPhone = normalizePhoneNumber(phone);

      if (!report || !isImproperParking || !normalizedPhone) {
        setPreviewWarningNumber(1);
        return;
      }

      try {
        const priorWarningState = await getPriorWarningState(phone);
        const currentReportHistoryCount = report.responseHistory?.length || 0;
        const nextWarningNumber = Math.min(
          Math.max(
            priorWarningState.priorOffenceCount + 1,
            currentReportHistoryCount + 1
          ),
          2
        );

        setPreviewWarningNumber(nextWarningNumber);
      } catch (error) {
        console.error("Error checking warning preview:", error);
        setPreviewWarningNumber(1);
      }
    };

    updatePreviewWarning();
  }, [phone, report, isImproperParking]);

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
      const priorWarningState = await getPriorWarningState(trimmedPhone);
      const currentReportHistoryCount = report.responseHistory?.length || 0;
      const warningNumber = Math.min(
        Math.max(
          priorWarningState.priorOffenceCount + 1,
          currentReportHistoryCount + 1
        ),
        2
      );
      const warningLabel = getWarningLabel(warningNumber);
      const responseEntry = {
        name: trimmedName,
        phone: trimmedPhone,
        phoneNormalized: normalizedPhone,
        unit: "",
        notes: trimmedNotes,
        warningLevel: warningLabel,
        warningNumber,
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
                <div className="border rounded-3 p-3 alert alert-warning mb-0">
                  <p className="text-muted small text-uppercase mb-1">
                    Warning Notice
                  </p>
                  <p className="fw-semibold mb-2">
                    {warningNoticeCopy.title}
                  </p>
                  <p className="mb-0">
                    {warningNoticeCopy.body}
                  </p>
                  <p className="mb-0">
                    {warningNoticeCopy.instruction}
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
                    placeholder="Example: I acknowledge the warning."
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
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default AcknowledgeParking;
