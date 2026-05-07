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

function ClaimBike() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState("");

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
        text: "This case is no longer accepting claim submissions.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const reportRef = doc(db, "reports", id);

      await updateDoc(reportRef, {
        status: "Closed - Claimed",
        claimName: name.trim(),
        claimPhone: phone.trim(),
        claimProof: proof.trim(),
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage({
        type: "success",
        text: "Claim submitted successfully. This case has been closed as claimed.",
      });

      navigate(`/qr/${id}`);
    } catch (error) {
      console.error("Error submitting claim:", error);
      setMessage({
        type: "danger",
        text: "Unable to submit your claim right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="portal-card">
        <h1 className="fw-bold mb-4">Claim Bicycle</h1>

        <p className="text-muted fs-5">
          Submit your details to confirm that this bicycle is still in use.
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
            This case is already closed or removed. Claim submissions are no longer accepted.
          </div>
        ) : (
          <>
            {message && (
              <div className={`alert alert-${message.type}`} role="alert">
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Your Name</label>
                <input
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label">Proof / Description</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Example: This is my bicycle. It has a black basket and blue frame."
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  required
                />
              </div>

              <button
                className="btn btn-success"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Claim"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ClaimBike;
