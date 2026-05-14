import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const finalStatuses = [
  "Removed",
  "Closed",
  "Closed - Claimed",
  "Closed - Not Abandoned",
  "Acknowledged - 1st Warning",
  "Acknowledged - 2nd Warning",
  "Acknowledged - Repeated Offence",
];

const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function QRPage() {
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportRef = doc(db, "reports", id);

        const reportSnap = await getDoc(reportRef);

        if (reportSnap.exists()) {
          setReport({
            id: reportSnap.id,
            ...reportSnap.data(),
          });
        }

        setLoading(false);

      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="container py-5">
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container py-5">
        <h2>Report not found.</h2>
      </div>
    );
  }

  const expiryDate = report.expiryDate?.toDate
    ? report.expiryDate.toDate()
    : report.expiryDate
      ? new Date(report.expiryDate)
      : null;

  const today = new Date();

  const hasValidExpiryDate = expiryDate && !Number.isNaN(expiryDate.getTime());
  const isExpired = hasValidExpiryDate && today > expiryDate;
  const isFinalStatus = finalStatuses.includes(report.status);
  const isImproperParking = report.caseType === "improperParking";

  return (
    <div className="container py-5">

      <div className="portal-card">

        <h1 className="fw-bold mb-4">
          {isImproperParking
            ? "Improperly Parked Bicycle Notice"
            : "Bicycle Notice Information"}
        </h1>

        {isImproperParking && (
          <div className="alert alert-warning">
            If this bicycle belongs to you, submit a response to acknowledge
            that a warning has been given.
          </div>
        )}

        <p className="fs-5">
          <strong>Report ID:</strong> {report.id}
        </p>

        <p className="fs-5">
          <strong>Block:</strong> {report.blockNumber}
        </p>

        <p className="fs-5">
          <strong>Location:</strong> {report.location}
        </p>

        <p className="fs-5">
          <strong>Status:</strong> {report.status}
        </p>

        <p className="fs-5">
          <strong>Compliance Points:</strong> {report.compliancePoints ?? 100}/100
        </p>

        {isImproperParking && (
          <div className="border rounded-3 p-3 mb-4 bg-light">
            <p className="fw-bold mb-2">
              Monthly Compliance Score
            </p>

            <p className="mb-0">
              Residents start each month with 100/100 points. First offences
              deduct 5 points, second offences deduct 10 points, and repeated
              offences deduct more. If no offences are recorded, 10 recovery
              points can be added monthly.
            </p>
          </div>
        )}

        {isImproperParking && report.enforcementReviewRequired && (
          <div className="alert alert-danger">
            This compliance score has reached 0 and has been flagged for Town
            Council review and possible enforcement action.
          </div>
        )}

        {hasValidExpiryDate && (
          <p className="fs-5">
            <strong>Notice Expiry Date:</strong>{" "}
            {formatDate(expiryDate)}
          </p>
        )}

        <div className="mt-4">

          {isFinalStatus ? (
            <div className="alert alert-success">
              {isImproperParking && report.status?.startsWith("Acknowledged")
                ? "Your acknowledgement has been recorded. No further action is required for this notice."
                : "This case is already closed. No further resident action is required."}
            </div>
          ) : !hasValidExpiryDate ? (
            <div className="alert alert-info">
              This bicycle has not been tagged yet. Notice period information is not available.
            </div>
          ) : isExpired ? (
            <div className="alert alert-danger">
              Notice period has expired. Bicycle may be removed by Town Council.
            </div>
          ) : (
            <div className="alert alert-warning">
              Bicycle is currently under notice period.
            </div>
          )}

        </div>

        {!isFinalStatus && !isImproperParking && (
          <div className="d-flex flex-wrap gap-3 mt-4">

            <a href={`/claim/${report.id}`} className="btn btn-success">
              Claim Bicycle
            </a>

            <a href={`/not-abandoned/${report.id}`} className="btn btn-outline-secondary">
              Report Not Abandoned
            </a>

          </div>
        )}

        {!isFinalStatus && isImproperParking && (
          <div className="d-flex flex-wrap gap-3 mt-4">
            <a href={`/acknowledge/${report.id}`} className="btn btn-warning">
              Submit Acknowledgement
            </a>
          </div>
        )}

      </div>

    </div>
  );
}

export default QRPage;
