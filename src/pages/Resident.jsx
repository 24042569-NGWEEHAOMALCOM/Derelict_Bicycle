import { Link } from "react-router-dom";

function Resident() {
  return (
    <div className="container py-5">

      <div className="mb-5">
        <h1 className="fw-bold display-5">
          Resident Portal
        </h1>

        <p className="text-muted fs-4">
          Report abandoned bicycles and respond to QR notices when needed.
        </p>
      </div>

      <div className="row g-4">

        <div className="col-md-6">
          <Link
            to="/report"
            className="text-decoration-none"
          >
            <div className="portal-card h-100">

              <div className="icon-box icon-blue mb-4">
                Report
              </div>

              <h3 className="fw-bold">
                Report Bicycle
              </h3>

              <p className="text-muted fs-5">
                Submit reports for suspected abandoned bicycles with location and details.
              </p>

            </div>
          </Link>
        </div>

        <div className="col-md-6">
          <div className="portal-card h-100">

            <div className="icon-box icon-green mb-4">
              QR
            </div>

            <h3 className="fw-bold">
              Scan QR Code
            </h3>

            <p className="text-muted fs-5">
              Scan QR tags attached to bicycles to view notice periods, claim ownership,
              or report that a bicycle is not abandoned.
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Resident;
