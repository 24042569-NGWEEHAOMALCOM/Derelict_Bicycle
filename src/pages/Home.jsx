import { Link } from "react-router-dom";

function Home() {
  return (
    <div>
      <section className="hero-section">
        <h1 className="hero-title">Derelict Bicycle Management System</h1>
        <p className="hero-subtitle">
          A digital solution for managing abandoned bicycles in Nee Soon Town Council.
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
                  Report abandoned bicycles, track your reports, scan QR codes,
                  and claim ownership.
                </p>

                <ul className="fs-5 text-muted">
                  <li>Report suspected bicycles with photos</li>
                  <li>Track report status and updates</li>
                  <li>Scan QR codes for bicycle information</li>
                  <li>Submit ownership claims</li>
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
                  Manage bicycle lifecycle, tag and remove bicycles, and view analytics.
                </p>

                <ul className="fs-5 text-muted">
                  <li>Dashboard with real-time statistics</li>
                  <li>Tag bicycles and generate QR codes</li>
                  <li>Manage removals and storage</li>
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