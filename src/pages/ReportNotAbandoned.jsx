import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function ReportNotAbandoned() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [reason, setReason] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const reportRef = doc(db, "reports", id);

    await updateDoc(reportRef, {
      status: "Closed - Not Abandoned",
      notAbandonedReason: reason,
      notAbandonedAt: new Date(),
      updatedAt: new Date(),
    });

    alert("Thank you. This case has been marked as not abandoned.");
    navigate(`/qr/${id}`);
  };

  return (
    <div className="container py-5">
      <div className="portal-card">
        <h1 className="fw-bold mb-4">Report Not Abandoned</h1>

        <p className="text-muted fs-5">
          Use this form if the bicycle is still in use and should not be removed.
        </p>

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

          <button className="btn btn-primary">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

export default ReportNotAbandoned;