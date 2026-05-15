import { Link } from "react-router-dom";

function Resident() {
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
                Park
              </div>

              <h3 className="fw-bold">
                Report Improper Parking
              </h3>

              <p className="text-muted fs-5">
                Report bicycles blocking pathways, doors, pipes, or causing obstruction.
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

        <div className="col-md-4">
          <Link to="/compliance" className="text-decoration-none">
            <div className="portal-card h-100">

              <div className="icon-box icon-green mb-4">
                Points
              </div>

              <h3 className="fw-bold">
                Check Compliance Points
              </h3>

              <p className="text-muted fs-5">
                Check whether you are qualified for the monthly NTUC voucher incentive.
              </p>

            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}

export default Resident;
