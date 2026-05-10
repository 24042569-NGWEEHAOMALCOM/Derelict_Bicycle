import { useState } from "react";
import { useNavigate } from "react-router-dom";

function ScanQRCode() {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const parseScanInput = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
      const url = new URL(trimmed);
      if (url.pathname.startsWith("/qr/")) {
        return url.pathname.replace("/qr/", "").split("/")[0];
      }
    } catch {
      // Not a URL, use raw value
    }

    return trimmed;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const reportId = parseScanInput(inputValue);

    if (!reportId) {
      setError("Please paste a valid QR result or report ID.");
      return;
    }

    setError("");
    navigate(`/qr/${reportId}`);
  };

  return (
    <div className="container py-5">
      <div className="mb-5">
        <h1 className="fw-bold display-5">Scan QR Code</h1>
        <p className="text-muted fs-5">
          Paste the QR code result or report ID here, then open the bicycle notice page.
        </p>
      </div>

      <div className="portal-card p-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="qrInput" className="form-label">
              QR scan result or report ID
            </label>
            <input
              id="qrInput"
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="form-control"
              placeholder="e.g. https://your-site/qr/abc123 or abc123"
            />
            <div className="form-text">
              If your scanner returns a link, paste it here. Otherwise paste the report ID.
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button type="submit" className="btn btn-primary">
            Open Notice
          </button>
        </form>
      </div>
    </div>
  );
}

export default ScanQRCode;
