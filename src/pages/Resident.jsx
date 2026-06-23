import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { Link } from "react-router-dom";

function Resident() {
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupMessage, setLookupMessage] = useState(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const handleLookup = async (e) => {
    e.preventDefault();

    const normalizedEmail = lookupEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setLookupMessage({
        type: "danger",
        text: "Enter your email to look up your contribution points.",
      });
      setLookupResult(null);
      return;
    }

    setLookupMessage(null);
    setLookupResult(null);
    setIsLookupLoading(true);

    try {
      const reportsQuery = query(
        collection(db, "reports"),
        where("reporterEmail", "==", normalizedEmail)
      );

      const querySnapshot = await getDocs(reportsQuery);

      if (querySnapshot.empty) {
        setLookupMessage({
          type: "warning",
          text: "No reports found for that email.",
        });
        return;
      }

      const residentReports = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      const totalPoints = residentReports.reduce(
        (sum, report) => sum + (report.pointsEarned || 0),
        0
      );

      setLookupResult({
        reports: residentReports,
        totalPoints,
        voucherCount: Math.floor(totalPoints / 100),
      });
    } catch (error) {
      console.error("Resident points lookup failed:", error);
      setLookupMessage({
        type: "danger",
        text: "Unable to look up points right now. Please try again later.",
      });
    } finally {
      setIsLookupLoading(false);
    }
  };

  return (
    <div className="container py-5">

      <div className="mb-5">
        <h1 className="fw-bold display-5">
          Resident Portal
        </h1>

        <p className="text-muted fs-4">
          Report bicycle issues and respond to QR notices when needed.
        </p>
      </div>

      <div className="row g-4">

        <div className="col-md-4">
          <Link
            to="/report"
            className="text-decoration-none"
          >
            <div className="portal-card h-100">

              <div className="icon-box icon-blue mb-4">
                Report
              </div>

              <h3 className="fw-bold">
                Report Abandoned Bicycle
              </h3>

              <p className="text-muted fs-5">
                Submit reports for suspected abandoned bicycles with location and details.
              </p>

            </div>
          </Link>
        </div>

        <div className="col-md-4">
          <Link
            to="/report/improper-parking"
            className="text-decoration-none"
          >
            <div className="portal-card h-100">

              <div className="icon-box icon-blue mb-4">
                Report
              </div>

              <h3 className="fw-bold">
                Report Improperly Parked Bicycle
              </h3>

              <p className="text-muted fs-5">
                Submit reports for bicycles blocking pathways or causing obstruction with location and details.
              </p>

            </div>
          </Link>
        </div>

        <div className="col-md-4">
          <Link to="/scan" className="text-decoration-none">
            <div className="portal-card h-100">

              <div className="icon-box icon-green mb-4">
                QR
              </div>

              <h3 className="fw-bold">
                Scan QR Code
              </h3>

              <p className="text-muted fs-5">
                Scan QR tags attached to bicycles to view notices, claim ownership,
                or acknowledge improper parking warnings.
              </p>

            </div>
          </Link>
        </div>

      </div>

      <div className="portal-card mt-5">
        <div className="mb-4">
          <h2 className="fw-bold h3">Points Lookup</h2>
          <p className="text-muted fs-5 mb-0">
            Verified reports earn 10 points and 100 points earns will be entered for $5 NTUC voucher lucky draw.
          </p>
        </div>

        <form onSubmit={handleLookup} className="row g-3 align-items-end">
          <div className="col-md-8">
            <label className="form-label" htmlFor="lookupEmail">
              Your Email
            </label>
            <input
              className="form-control form-control-lg"
              id="lookupEmail"
              type="email"
              placeholder="example@gmail.com"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              required
            />
          </div>

          <div className="col-md-4">
            <button
              className="btn btn-primary btn-lg w-100"
              type="submit"
              disabled={isLookupLoading}
            >
              {isLookupLoading ? "Checking..." : "Check Points"}
            </button>
          </div>
        </form>

        {lookupMessage && (
          <div className={`alert alert-${lookupMessage.type} mt-4`} role="alert">
            {lookupMessage.text}
          </div>
        )}

        {lookupResult && (
          <div className="mt-4">
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="border rounded-3 p-3 h-100">
                  <p className="text-uppercase text-muted small mb-2">Total Points</p>
                  <p className="display-6 fw-bold mb-0">{lookupResult.totalPoints}</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded-3 p-3 h-100">
                  <p className="text-uppercase text-muted small mb-2">Eligible $5 Voucher lucky draw entries</p>
                  <p className="display-6 fw-bold mb-0">{lookupResult.voucherCount}</p>
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Status</th>
                    <th className="text-end">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupResult.reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.id}</td>
                      <td>{report.status}</td>
                      <td className="text-end fw-bold">{report.pointsEarned || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Resident;
