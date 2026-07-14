import { Link } from "react-router-dom";

function Home() {
  return (
    <div>
      <section className="hero-section">
        <h1 className="hero-title">Derelict Bicycle Management System</h1>
        <p className="hero-subtitle">
          A digital solution for managing abandoned and improperly parked bicycles in Nee Soon Town Council.
          <br />
          Improving efficiency for staff and transparency for residents.
        </p>
      </section>

      <div className="container pb-5">
        <div className="row g-5">
          <div className="col-md-6">
            <Link to="/resident" className="text-decoration-none text-dark">
              <div className="portal-card">
                <div className="d-flex align-items-center gap-4 mb-4">
                  <div className="icon-box icon-blue">👥</div>
                  <h2 className="fw-bold m-0">Resident Portal</h2>
                </div>

                <p className="fs-4 text-muted">
                  Report abandoned or improperly parked bicycles, scan QR notices, and submit ownership responses.
                </p>

                <ul className="fs-5 text-muted">
                  <li>Report suspected abandoned bicycles</li>
                  <li>Report improperly parked bicycles</li>
                  <li>Scan QR codes for bicycle notice information</li>
                  <li>Check points and lucky draw eligibility</li>
                  <li>Submit ownership claims or parking warning acknowledgements</li>
                </ul>
              </div>
            </Link>
          </div>

          <div className="col-md-6">
            <Link to="/staff" className="text-decoration-none text-dark">
              <div className="portal-card">
                <div className="d-flex align-items-center gap-4 mb-4">
                  <div className="icon-box icon-green">🛡️</div>
                  <h2 className="fw-bold m-0">Staff Portal</h2>
                </div>

                <p className="fs-4 text-muted">
                  Manage bicycle lifecycle, tag notices, track warnings, and view analytics.
                </p>

                <ul className="fs-5 text-muted">
                  <li>Dashboard with real-time statistics</li>
                  <li>Search, verify and update reports</li>
                  <li>Tag bicycles and generate QR codes</li>
                  <li>Record improper parking warnings</li>
                  <li>Manage removals and storage</li>
                  <li>Review AI-assisted duplicate reports</li>
                  <li>Manage resident incentives & lucky draw</li>
                  <li>Export winners records to CSV</li>
                  <li>Analytics and hotspot mapping</li>
                </ul>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
