import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const finalStatuses = [
  "Removed",
  "Closed",
  "Closed - Claimed",
  "Closed - Not Abandoned",
];

function ReportNotAbandoned() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [reason, setReason] = useState("");

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
        console.error("Error fetching report:", error);
        setMessage({
          type: "danger",
          text: "Unable to load this report right now. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  const isFinalStatus = finalStatuses.includes(report?.status);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!report || isFinalStatus) {
      setMessage({
        type: "warning",
        text: "This case is no longer accepting not-abandoned reports.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const reportRef = doc(db, "reports", id);

      await updateDoc(reportRef, {
        status: "Closed - Not Abandoned",
        notAbandonedReason: reason.trim(),
        notAbandonedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage({
        type: "success",
        text: "Thank you. This case has been marked as not abandoned.",
      });

      navigate(`/qr/${id}`);
    } catch (error) {
      console.error("Error submitting not-abandoned report:", error);
      setMessage({
        type: "danger",
        text: "Unable to submit this response right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="portal-card">
        <h1 className="fw-bold mb-4">Report Not Abandoned</h1>

        <p className="text-muted fs-5">
          Use this form if the bicycle is still in use and should not be removed.
        </p>

        {loading ? (
          <div className="alert alert-info">
            Loading report...
          </div>
        ) : !report ? (
          <div className="alert alert-danger">
            Report not found.
          </div>
        ) : isFinalStatus ? (
          <div className="alert alert-warning">
            This case is already closed or removed. Not-abandoned reports are no longer accepted.
          </div>
        ) : (
          <>
            {message && (
              <div className={`alert alert-${message.type}`} role="alert">
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="form-label">Reason</label>
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder="Example: I use this bicycle daily but parked it here temporarily."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <button
                className="btn btn-primary"
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

export default ReportNotAbandoned;
