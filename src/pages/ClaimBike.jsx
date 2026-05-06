import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function ClaimBike() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const reportRef = doc(db, "reports", id);

    await updateDoc(reportRef, {
      status: "Closed - Claimed",
      claimName: name,
      claimPhone: phone,
      claimProof: proof,
      claimedAt: new Date(),
      updatedAt: new Date(),
    });

    alert("Claim submitted successfully. This case has been closed as claimed.");
    navigate(`/qr/${id}`);
  };

  return (
    <div className="container py-5">
      <div className="portal-card">
        <h1 className="fw-bold mb-4">Claim Bicycle</h1>

        <p className="text-muted fs-5">
          Submit your details to confirm that this bicycle is still in use.
        </p>

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

          <button className="btn btn-success">
            Submit Claim
          </button>
        </form>
      </div>
    </div>
  );
}

export default ClaimBike;