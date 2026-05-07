import { useState } from "react";

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

const initialForm = {
  blockNumber: "",
  location: "",
  description: "",
};

function ReportBike() {
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const report = {
      blockNumber: formData.blockNumber.trim(),
      location: formData.location.trim(),
      description: formData.description.trim(),
    };

    if (!report.blockNumber || !report.location || !report.description) {
      setMessage({
        type: "danger",
        text: "Please complete all fields before submitting your report.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "reports"), {
        ...report,
        status: "Reported",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setFormData(initialForm);
      setMessage({
        type: "success",
        text: "Report submitted successfully. Town Council staff can now review it.",
      });
    } catch (error) {
      console.error("Error adding report: ", error);
      setMessage({
        type: "danger",
        text: "We could not submit your report right now. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="portal-card mx-auto" style={{ maxWidth: "860px" }}>
        <div className="mb-4">
          <h1 className="fw-bold mb-3">Report Abandoned Bicycle</h1>
          <p className="text-muted fs-5 mb-0">
            Share the bicycle location and any identifying details so staff can
            inspect it quickly.
          </p>
        </div>

        {message && (
          <div className={`alert alert-${message.type}`} role="alert">
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-4">
            <div className="col-md-6">
              <label className="form-label" htmlFor="blockNumber">
                Block Number
              </label>
              <input
                className="form-control form-control-lg"
                id="blockNumber"
                name="blockNumber"
                type="text"
                placeholder="Example: 838"
                value={formData.blockNumber}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="location">
                Exact Location
              </label>
              <input
                className="form-control form-control-lg"
                id="location"
                name="location"
                type="text"
                placeholder="Example: 838 Void Deck"
                value={formData.location}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="description">
                Bicycle Description
              </label>
              <textarea
                className="form-control"
                id="description"
                name="description"
                rows="3"
                placeholder="Example: Rusty red mountain bike with flat tyres and a missing seat."
                value={formData.description}
                onChange={handleChange}
                required
              />
              <div className="form-text">
                Include colour, condition or anything that
                helps staff identify the bicycle.
              </div>
            </div>
          </div>

          <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-3 mt-4">
            <button
              className="btn btn-primary btn-lg px-4"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportBike;
