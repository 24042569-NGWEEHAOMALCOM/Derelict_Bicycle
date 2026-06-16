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
];

const firstWarningStatus = "Acknowledged - 1st Warning";
const secondWarningStatus = "Acknowledged - 2nd Warning";


const getDisplayStatus = (status) => {
  if (status === firstWarningStatus || status === secondWarningStatus) {
    return status;
  }

  return status;
};

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
  const isImproperParking = report.caseType === "improperParking";
  const isAcknowledgedNotice = report.status?.startsWith("Acknowledged -");
  const displayStatus = getDisplayStatus(report.status);
  const isSecondWarningNotice =
    isImproperParking &&
    (displayStatus === secondWarningStatus || report.warningNumber >= 2);
  const isFinalStatus =
    finalStatuses.includes(report.status) ||
    (isImproperParking && isAcknowledgedNotice);

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
          
            <p className="mb-0">
              {isSecondWarningNotice
                ? "2nd warning for improper parking. It has been locked by Town Council. Please head down to the Town Council office for assistance."
                : "This bicycle has been reported for improper parking by Nee Soon Town Council."}
            </p>
          </div>
        )}

        <div className="alert alert-warning d-flex flex-wrap gap-3 mt-4">
            <p className="mb-0">
              This bicycle has been identified as a possible abandoned bicycle by Nee Soon Town Council.
            </p>
        </div>

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
          <strong>Status:</strong> {displayStatus}
        </p>

        {hasValidExpiryDate && (
          <p className="fs-5">
            <strong>Notice Expiry Date:</strong>{" "}
            {formatDate(expiryDate)}
          </p>
        )}

        <div className="mt-4">

          {isFinalStatus ? (
            <div className="alert alert-success">
              {isSecondWarningNotice
                ? "This 2nd warning has been recorded. Please visit the Town Council office for assistance."
                : isImproperParking && report.status?.startsWith("Acknowledged")
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
          ) : isImproperParking ? null : (
            <div className="alert alert-warning">
              If this bicycle belongs to you, please submit a response before the expiry date.
              Otherwise, the bicycle may be removed by Nee Soon Town Council.
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

        <div className="alert alert-warning d-flex flex-wrap gap-3 mt-4">
            <p className="mb-0">
              Questions about this notice? Contact us at <a href="mailto:feedback@nstc.org.sg">feedback@nstc.org.sg</a>
            </p>
        </div>

        {!isFinalStatus && isImproperParking && (
          <div className="d-flex flex-wrap gap-3 mt-4">
            <a href={`/acknowledge/${report.id}`} className="btn btn-warning">
              Next
            </a>
          </div>
        )}

      </div>

    </div>
  );
}

export default QRPage;
