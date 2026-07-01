import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

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

function PrintNotice() {
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

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
        console.error("Error fetching printable notice:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="container py-5">
        <h1 className="fw-bold">Loading notice...</h1>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container py-5">
        <div className="portal-card">
          <h1 className="fw-bold">Notice not found</h1>
          <p className="text-muted fs-5 mb-0">
            The selected report could not be found.
          </p>
        </div>
      </div>
    );
  }

  const canPrintNotice = report.status === "Tagged" && report.qrCodeImage;
  const isImproperParking = report.caseType === "improperParking";
  const noticeTitle = isImproperParking
    ? "Improper Parking Notice"
    : "Derelict Bicycle Notice";
  const noticeSubtitle = isImproperParking
    ? "This bicycle has been verified as improperly parked and causing obstruction."
    : "This bicycle has been identified for abandoned bicycle review.";

  return (
    <div className="container py-5">
      <div className="d-flex flex-wrap gap-3 mb-4 print-actions">
        <Link to="/staff" className="btn btn-outline-secondary">
          Back to Staff Dashboard
        </Link>

        <button
          className="btn btn-primary"
          type="button"
          onClick={() => window.print()}
          disabled={!canPrintNotice}
        >
          Print Notice
        </button>
      </div>

      {!canPrintNotice && (
        <div className="alert alert-warning print-actions">
          This report must be marked as Tagged before a printable QR notice is available.
        </div>
      )}

      <div className="notice-page mx-auto">
        <div className="notice-header">
          <p className="notice-council mb-1">
            Nee Soon Town Council
          </p>

          <h1 className="notice-title">
            {noticeTitle}
          </h1>

          <p className="notice-subtitle mb-0">
            {noticeSubtitle}
          </p>
        </div>

        <div className="notice-alert">
          {isImproperParking
            ? "If this bicycle belongs to you, scan the QR code and submit a response to acknowledge that a warning has been given."
            : "If this bicycle belongs to you, scan the QR code and submit a response before the notice period ends."}
        </div>

        <div className="notice-grid">
          <div>
            <p className="notice-label">Report ID</p>
            <p className="notice-value">{report.id}</p>
          </div>

          <div>
            <p className="notice-label">Status</p>
            <p className="notice-value">{report.status || "Unknown"}</p>
          </div>

          <div>
            <p className="notice-label">Block</p>
            <p className="notice-value">{report.blockNumber || "Not provided"}</p>
          </div>

          <div>
            <p className="notice-label">Location</p>
            <p className="notice-value">{report.location || "Not provided"}</p>
          </div>

          <div>
            <p className="notice-label">Case Type</p>
            <p className="notice-value">
              {isImproperParking ? "Improperly Parked Bicycle" : "Abandoned Bicycle"}
            </p>
          </div>

          <div>
            <p className="notice-label">Tagged Date</p>
            <p className="notice-value">{formatDate(report.tagDate)}</p>
          </div>

          <div>
            <p className="notice-label">Notice Expiry Date</p>
            <p className="notice-value">{formatDate(report.expiryDate)}</p>
          </div>
        </div>

        <div className="notice-qr-section">
          {report.qrCodeImage ? (
            <img
              src={report.qrCodeImage}
              alt="Bicycle notice QR code"
              className="notice-qr"
            />
          ) : (
            <div className="notice-qr-placeholder">
              QR code not generated
            </div>
          )}

          <div>
            <h2 className="notice-section-title">
              Scan to Respond
            </h2>

            <p className="notice-body">
              {isImproperParking
                ? "Use this QR code to acknowledge the improper parking warning."
                : "Use this QR code to claim the bicycle or report that it is not abandoned."}
            </p>

            <p className="notice-url">
              {report.qrUrl || `${window.location.origin}/qr/${report.id}`}
            </p>
          </div>
        </div>

        <div className="notice-footer">
          {isImproperParking
            ? "This notice is a 1st warning for improper parking. If the bicycle commits a 2nd improper parking offence, it will be locked by Town Council and the resident must visit the Town Council office for assistance."
            : "Bicycle may be removed by Town Council after the notice period if no valid response is received."}
        </div>
      </div>
    </div>
  );
}

export default PrintNotice;
