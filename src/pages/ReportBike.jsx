import { useState, useEffect } from "react";

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { uploadImageToCloudinary } from "../services/cloudinaryService";
import { InteractiveMapDisplay } from "../components/MapDisplay";

const reportConfigs = {
  abandoned: {
    caseType: "abandoned",
    title: "Report Abandoned Bicycle",
    subtitle:
      "Share the bicycle location and any identifying details so staff can inspect it quickly.",
    descriptionPlaceholder:
      "Example: Rusty red mountain bike with flat tyres and a missing seat.",
    successText:
      "Report submitted successfully! Town Council staff will review it within 24 hours.",
    notificationBody:
      "Your bicycle report has been submitted. Staff will review it soon.",
  },
  improperParking: {
    caseType: "improperParking",
    title: "Report Improperly Parked Bicycle",
    subtitle:
      "Report bicycles that are blocking pathways, locked onto pipes, blocking electrical rooms, or causing obstruction.",
    descriptionPlaceholder:
      "Example: Blue foldable bicycle blocking the electrical room door.",
    successText:
      "Improper parking report submitted successfully! Town Council staff will review it within 24 hours.",
    notificationBody:
      "Your improper parking report has been submitted. Staff will review it soon.",
  },
};

const initialForm = {
  blockNumber: "",
  location: "",
  description: "",
  hasLock: "",
  condition: "",
  licensePlate: "",
};

function ReportBike({ reportType = "abandoned" }) {
  const config = reportConfigs[reportType] || reportConfigs.abandoned;
  const [formData, setFormData] = useState(initialForm);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);

  useEffect(() => {
    // Request notification permission on component mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (max 1200px width/height)
        const maxSize = 1200;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
          },
          "image/jpeg",
          0.8 // 80% quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0] || null;

    if (file) {
      const maxFileSize = 10 * 1024 * 1024; // 10MB

      if (file.size > maxFileSize) {
        setMessage({
          type: "warning",
          text: "Image is too large. Maximum size is 10MB.",
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        setMessage({
          type: "warning",
          text: "Please select a valid image file.",
        });
        return;
      }

      // Compress the image
      const compressedImage = await compressImage(file);
      setSelectedImage(compressedImage);
    } else {
      setSelectedImage(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const report = {
      blockNumber: formData.blockNumber.trim(),
      location: formData.location.trim(),
      description: formData.description.trim(),
      bicycleType: "",
      hasLock: formData.hasLock,
      condition: formData.condition,
      licensePlate: formData.licensePlate.trim(),
      gpsLocation: gpsLocation,
      caseType: config.caseType,
      caseTypeLabel:
        config.caseType === "improperParking"
          ? "Improperly Parked Bicycle"
          : "Abandoned Bicycle",
      compliancePoints: config.caseType === "improperParking" ? 100 : null,
      compliancePointsDeducted: config.caseType === "improperParking" ? 0 : null,
      offencePointsDeducted: config.caseType === "improperParking" ? 0 : null,
      monthlyStartingCompliancePoints: config.caseType === "improperParking" ? 100 : null,
      monthlyRecoveryPoints: config.caseType === "improperParking" ? 10 : null,
      enforcementReviewRequired: false,
      responseHistory: config.caseType === "improperParking" ? [] : null,
    };

    if (!report.blockNumber || !report.location || !report.description) {
      setMessage({
        type: "danger",
        text: "Please complete all required fields before submitting your report.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image if selected
      const imageUrl = selectedImage
        ? await uploadImageToCloudinary(selectedImage)
        : "";

      await addDoc(collection(db, "reports"), {
        ...report,
        imageUrl,
        status: "Reported",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Reset form
      setFormData(initialForm);
      setSelectedImage(null);
      setGpsLocation(null);
      e.target.reset();

      // Browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Report Submitted Successfully!", {
          body: config.notificationBody,
          icon: "/vite.svg",
        });
      }

      setMessage({
        type: "success",
        text: config.successText,
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
          <h1 className="fw-bold mb-3">{config.title}</h1>
          <p className="text-muted fs-5 mb-0">
            {config.subtitle}
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
                Block Number <span className="text-danger">*</span>
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
                Exact Location <span className="text-danger">*</span>
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
              <div className="form-text">
                Describe the exact location (optional - use the map below to pinpoint)
              </div>
            </div>

            {/* GPS Map Display - Interactive */}
            <div className="col-12">
              <label className="form-label">
                📍 Set Bicycle Location on Map
              </label>
              <InteractiveMapDisplay
                onLocationSelect={(location) => {
                  setGpsLocation(location);
                  setMessage({
                    type: "success",
                    text: `Location set: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
                  });
                }}
              />
              {gpsLocation && (
                <div className="mt-2 p-3 bg-light rounded">
                  <p className="mb-1 fw-semibold">📍 Location Selected:</p>
                  <p className="mb-0 text-muted">
                    {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="condition">
                Condition
              </label>
              <select
                className="form-select form-select-lg"
                id="condition"
                name="condition"
                value={formData.condition}
                onChange={handleChange}
              >
                <option value="">Select condition (optional)</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="hasLock">
                Has Lock?
              </label>
              <select
                className="form-select form-select-lg"
                id="hasLock"
                name="hasLock"
                value={formData.hasLock}
                onChange={handleChange}
              >
                <option value="">Select option (optional)</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="broken">Broken Lock</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="licensePlate">
                License Plate (if visible)
              </label>
              <input
                className="form-control form-control-lg"
                id="licensePlate"
                name="licensePlate"
                type="text"
                placeholder="Example: ABC123"
                value={formData.licensePlate}
                onChange={handleChange}
              />
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="description">
                Bicycle Description <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                id="description"
                name="description"
                rows="3"
                placeholder={config.descriptionPlaceholder}
                value={formData.description}
                onChange={handleChange}
                required
              />
              <div className="form-text">
                Include colour, condition or anything that helps staff identify the bicycle.
              </div>
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="bicycleImage">
                Bicycle Image
              </label>
              <input
                accept="image/*"
                className="form-control form-control-lg"
                id="bicycleImage"
                name="bicycleImage"
                type="file"
                onChange={handleImageChange}
              />
              <div className="form-text">
                Upload a clear photo of the bicycle if available. Image will be automatically compressed for faster upload.
              </div>

              {selectedImage && (
                <div className="mt-3">
                  <p className="mb-2 fw-semibold">Selected Image:</p>
                  <div className="d-flex align-items-center gap-3">
                    <img
                      src={URL.createObjectURL(selectedImage)}
                      alt="Preview"
                      className="img-thumbnail"
                      style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    />
                    <div>
                      <p className="mb-1 small text-muted">{selectedImage.name}</p>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setSelectedImage(null)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-3 mt-4">
            <button
              className="btn btn-primary btn-lg px-4"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Uploading...
                </>
              ) : (
                "Submit Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportBike;
