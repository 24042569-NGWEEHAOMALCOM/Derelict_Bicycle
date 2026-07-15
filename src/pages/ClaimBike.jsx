import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const finalStatuses = [
  "Closed",
  "Closed - Claimed",
  "Closed - Not Abandoned",
  "Pending Owner Claim",
];

function ClaimBike() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledEmail = searchParams.get("email");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportSnap = await getDoc(doc(db, "reports", id));

        if (reportSnap.exists()) {
          const reportData = {
            id: reportSnap.id,
            ...reportSnap.data(),
          };
          setReport(reportData);

          // If email is provided in URL and matches reporter email, verify automatically
          if (prefilledEmail) {
            const reporterEmail = reportData.reporterEmail?.trim().toLowerCase();
            const paramEmail = prefilledEmail.trim().toLowerCase();

            if (reporterEmail && reporterEmail === paramEmail) {
              setEmailVerified(true);
            }
          }
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
  }, [id, prefilledEmail]);

  const isFinalStatus = finalStatuses.includes(report?.status);
  const canSubmitRemovedClaim = report?.status === "Removed";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!report || isFinalStatus || !canSubmitRemovedClaim) {
      setMessage({
        type: "warning",
        text: "Owner claims are only accepted after the bicycle has been removed.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const reportRef = doc(db, "reports", id);

      await updateDoc(reportRef, {
        status: "Pending Owner Claim",
        claimName: name.trim(),
        claimPhone: phone.trim(),
        claimProof: proof.trim(),
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage({
        type: "success",
        text: "Claim submitted successfully. Staff will verify ownership during physical collection.",
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
          Submit your details after the bicycle has been removed so staff can verify ownership during collection.
        </p>

        {loading ? (
          <div className="alert alert-info">
            Loading report...
          </div>
        ) : !report ? (
          <div className="alert alert-danger">
            Report not found.
          </div>
        ) : isFinalStatus || !canSubmitRemovedClaim ? (
          <div className="alert alert-warning">
            {isFinalStatus
              ? "This case is already closed or already has an owner claim pending."
              : "This bicycle has not been removed yet. If it is still in use, submit a not-abandoned response from the QR notice page."}
          </div>
        ) : (
          <>
            {emailVerified && (
              <div className="alert alert-success mb-4">
                <strong>Email verified!</strong> You're claiming this bicycle from the direct link sent to your registered email address.
              </div>
            )}

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
