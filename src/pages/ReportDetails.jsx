import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../firebase/firebase";

const firstWarningStatus = "Acknowledged - 1st Warning";
const secondWarningStatus = "Acknowledged - 2nd Warning";
const lockedSecondWarningStatus =
  "Acknowledged - 2nd Warning (Bicycle has been locked)";

const getDisplayStatus = (status) => {
  if (status === firstWarningStatus || status === secondWarningStatus) {
    return status;
  }

  if (status === lockedSecondWarningStatus || status?.startsWith("Acknowledged -")) {
    return secondWarningStatus;
  }

  return status;
};

const getBadgeClass = (status) => {
  if (status === "Reported") return "bg-secondary";
  if (status === "Verified") return "bg-info";
  if (status === "Verified: Improperly Parked") return "bg-info";
  if (status === "Tagged") return "bg-warning text-dark";
  if (getDisplayStatus(status) === firstWarningStatus) return "bg-warning text-dark";
  if (getDisplayStatus(status) === secondWarningStatus) return "bg-danger";
  if (status === "Removed") return "bg-danger";
  if (status === "Pending Owner Claim") return "bg-warning text-dark";
  if (status === "Closed") return "bg-success";
  if (status === "Closed - Claimed") return "bg-success";
  if (status === "Closed - Not Abandoned") return "bg-primary";

  return "bg-secondary";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "Not available";

  const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getReportTypeLabel = (report) =>
  report?.caseType === "improperParking"
    ? "Improperly Parked Bicycle"
    : "Abandoned Bicycle";

function ReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportSnap = await getDoc(doc(db, "reports", id));

        if (!reportSnap.exists()) {
          setMessage({
            type: "warning",
            text: "No report was found with that ID.",
          });
          return;
        }

        const reportData = {
          id: reportSnap.id,
          ...reportSnap.data(),
        };
        const savedEmail = window.sessionStorage.getItem(
          `residentReportAccess:${reportSnap.id}`
        );
        const reporterEmail = reportData.reporterEmail?.trim().toLowerCase();

        setReport(reportData);
        setIsVerified(Boolean(savedEmail && savedEmail === reporterEmail));
      } catch (error) {
        console.error("Error fetching report details:", error);
        setMessage({
          type: "danger",
          text: "Unable to load report details right now. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  const handleVerifyEmail = (event) => {
    event.preventDefault();

    const normalizedEmail = verificationEmail.trim().toLowerCase();
    const reporterEmail = report?.reporterEmail?.trim().toLowerCase();

    if (!normalizedEmail || normalizedEmail !== reporterEmail) {
      setMessage({
        type: "danger",
        text: "Email does not match this report.",
      });
      return;
    }

    window.sessionStorage.setItem(`residentReportAccess:${report.id}`, normalizedEmail);
    setMessage(null);
    setIsVerified(true);
  };

  return (
    <div className="container py-5">
      <div className="portal-card mx-auto" style={{ maxWidth: "980px" }}>
        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
          <div>
            <p className="text-uppercase fw-semibold text-primary mb-2">
              Report details
            </p>
            <h1 className="fw-bold mb-2">Resident Report View</h1>
            <p className="text-muted fs-5 mb-0">
              View submitted report information and latest case status.
            </p>
          </div>

          <div>
            <Link to="/resident" className="btn btn-outline-primary">
              Back to Points Lookup
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="alert alert-info">Loading report details...</div>
        ) : message && !report ? (
          <div className={`alert alert-${message.type} mb-0`} role="alert">
            {message.text}
          </div>
        ) : !isVerified ? (
          <div className="border rounded-3 p-4 bg-light">
            <h2 className="h4 fw-bold mb-3">Verify Reporter Email</h2>
            <p className="text-muted mb-4">
              Enter the reporter email used for this report before viewing the full details.
            </p>

            {message && (
              <div className={`alert alert-${message.type}`} role="alert">
                {message.text}
              </div>
            )}

            <form onSubmit={handleVerifyEmail} className="row g-3 align-items-end">
              <div className="col-md-8">
                <label className="form-label" htmlFor="verificationEmail">
                  Reporter Email
                </label>
                <input
                  className="form-control form-control-lg"
                  id="verificationEmail"
                  type="email"
                  value={verificationEmail}
                  onChange={(event) => setVerificationEmail(event.target.value)}
                  required
                />
              </div>

              <div className="col-md-4">
                <button className="btn btn-primary btn-lg w-100" type="submit">
                  View Details
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3 border rounded-3 p-4 bg-light mb-4">
              <div>
                <h2 className="h4 fw-bold mb-2">
                  {getReportTypeLabel(report)}
                </h2>
                <p className="text-muted mb-0">
                  Report ID: <span className="fw-semibold">{report.id}</span>
                </p>
              </div>

              <div className="text-md-end">
                <span className={`badge fs-6 ${getBadgeClass(report.status)}`}>
                  {getDisplayStatus(report.status) || "Unknown"}
                </span>
                <p className="text-muted mb-0 mt-2">
                  Points Earned: <span className="fw-semibold">{report.pointsEarned || 0}</span>
                </p>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Reporter</p>
                  <p className="fw-semibold mb-1">{report.reporterName || "Not provided"}</p>
                  <p className="mb-0 text-muted">{report.reporterEmail || "No email provided"}</p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Submitted</p>
                  <p className="mb-0">{formatDate(report.createdAt)}</p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Block</p>
                  <p className="fw-semibold mb-0">{report.blockNumber || "Not provided"}</p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Location</p>
                  <p className="fw-semibold mb-0">{report.location || "Not provided"}</p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Condition</p>
                  <p className="mb-0">{report.condition || "Not provided"}</p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Last Updated</p>
                  <p className="mb-0">{formatDate(report.updatedAt)}</p>
                </div>
              </div>

              <div className="col-12">
                <div className="bg-white rounded-3 border p-3">
                  <p className="text-muted small text-uppercase mb-1">Description</p>
                  <p className="mb-0">{report.description || "No description provided."}</p>
                </div>
              </div>

              {report.imageUrl && (
                <div className="col-12">
                  <div className="bg-white rounded-3 border p-3">
                    <p className="text-muted small text-uppercase mb-2">Submitted Image</p>
                    <img
                      src={report.imageUrl}
                      alt={`Reported bicycle at Block ${report.blockNumber || "unknown"}`}
                      className="report-image"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ReportDetails;
