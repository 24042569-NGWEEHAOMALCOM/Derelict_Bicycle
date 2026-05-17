import { useState } from "react";
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
  if (status === "Closed") return "bg-success";
  if (status === "Closed - Claimed") return "bg-success";
  if (status === "Closed - Not Abandoned") return "bg-primary";

  return "bg-secondary";
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

function TrackStatus() {
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();

    const trimmedReportId = reportId.trim();

    if (!trimmedReportId) {
      setReport(null);
      setMessage({
        type: "danger",
        text: "Enter a report ID to check its status.",
      });
      return;
    }

    setIsSearching(true);
    setMessage(null);
    setReport(null);

    try {
      const reportSnap = await getDoc(doc(db, "reports", trimmedReportId));

      if (!reportSnap.exists()) {
        setMessage({
          type: "warning",
          text: "No report was found with that ID. Check the ID and try again.",
        });
        return;
      }

      setReport({
        id: reportSnap.id,
        ...reportSnap.data(),
      });
    } catch (error) {
      console.error("Error fetching report: ", error);
      setMessage({
        type: "danger",
        text: "We could not check this report right now. Please try again.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="portal-card mx-auto" style={{ maxWidth: "860px" }}>
        <div className="mb-4">
          <p className="text-uppercase fw-semibold text-primary mb-2">
            Case lookup
          </p>
          <h1 className="fw-bold mb-3">Track Report Status</h1>
          <p className="text-muted fs-5 mb-0">
            Enter your report ID to see the latest case status and details.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-4">
          <label className="form-label" htmlFor="reportId">
            Report ID
          </label>
          <div className="input-group input-group-lg">
            <input
              className="form-control"
              id="reportId"
              type="text"
              placeholder="Example: 8fK2..."
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              disabled={isSearching}
            />
            <button
              className="btn btn-primary px-4"
              type="submit"
              disabled={isSearching}
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
          <div className="form-text">
            The report ID is generated after submitting a bicycle
            report.
          </div>
        </form>

        {message && (
          <div className={`alert alert-${message.type} mb-0`} role="alert">
            {message.text}
          </div>
        )}

        {report && (
          <div className="border rounded-3 p-4 bg-light">
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
              <div>
                <h2 className="fw-bold h3 mb-2">Report Found</h2>
                <p className="text-muted mb-0">
                  Report ID: <span className="fw-semibold">{report.id}</span>
                </p>
              </div>

              <div>
                <span className={`badge fs-6 ${getBadgeClass(report.status)}`}>
                  {getDisplayStatus(report.status) || "Unknown"}
                </span>
                <p className="text-muted mb-0 mt-2">
                  Points Earned: <span className="fw-semibold">{report.pointsEarned || 0}</span>
                </p>
              </div>
            </div>

            {(report.reporterName || report.reporterEmail) && (
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="bg-white rounded-3 border p-3 h-100">
                    <p className="text-muted small text-uppercase mb-1">
                      Reporter
                    </p>
                    <p className="fs-5 fw-semibold mb-1">
                      {report.reporterName || "Unknown"}
                    </p>
                    <p className="mb-0 text-muted">
                      {report.reporterEmail || "No email provided"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="row g-3">
              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Case Type
                  </p>
                  <p className="fs-5 fw-semibold mb-0">
                    {report.caseType === "improperParking"
                      ? "Improperly Parked Bicycle"
                      : "Abandoned Bicycle"}
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">Block</p>
                  <p className="fs-5 fw-semibold mb-0">
                    {report.blockNumber || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Location
                  </p>
                  <p className="fs-5 fw-semibold mb-0">
                    {report.location || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="col-12">
                <div className="bg-white rounded-3 border p-3">
                  <p className="text-muted small text-uppercase mb-1">
                    Description
                  </p>
                  <p className="mb-0">
                    {report.description || "No description provided."}
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Submitted
                  </p>
                  <p className="mb-0">{formatDate(report.createdAt)}</p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Last Updated
                  </p>
                  <p className="mb-0">{formatDate(report.updatedAt)}</p>
                </div>
              </div>

              {report.enforcementReviewRequired && (
                <div className="col-12">
                  <div className="alert alert-danger mb-0">
                    This case has been flagged for further Town Council review.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrackStatus;
