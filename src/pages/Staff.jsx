import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import QRCode from "qrcode";

function Staff() {
  const [reports, setReports] = useState([]);

  const fetchReports = async () => {
    const querySnapshot = await getDocs(collection(db, "reports"));

    const reportList = querySnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    setReports(reportList);
  };

  const updateStatus = async (reportId, newStatus) => {
    const reportRef = doc(db, "reports", reportId);

    let updateData = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === "Tagged") {

      try {

        console.log("Generating QR...");

        const tagDate = new Date();

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const qrUrl = `${window.location.origin}/qr/${reportId}`;

        console.log("QR URL:", qrUrl);

        const qrCodeImage = await QRCode.toDataURL(qrUrl);

        console.log("QR GENERATED");

        updateData = {
          ...updateData,
          tagDate,
          expiryDate,
          qrUrl,
          qrCodeImage,
        };

      } catch (error) {

        console.error("QR ERROR:", error);

      }
    }

    await updateDoc(reportRef, updateData);

    alert(`Status updated to ${newStatus}`);

    fetchReports();
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getBadgeClass = (status) => {

    if (status === "Reported")
      return "bg-secondary";

    if (status === "Verified")
      return "bg-info";

    if (status === "Tagged")
      return "bg-warning text-dark";

    if (status === "Removed")
      return "bg-danger";

    if (status === "Closed")
      return "bg-success";

    if (status === "Closed - Claimed")
      return "bg-success";

    if (status === "Closed - Not Abandoned")
      return "bg-primary";

    return "bg-secondary";
  };

  return (
    <div className="container py-5">
      <div className="mb-5">
        <h1 className="fw-bold display-5">
          Staff Dashboard
        </h1>

        <p className="text-muted fs-4">
          Manage reported bicycles, update statuses, and track case progress.
        </p>
      </div>

      <div className="row g-4 mb-5">

        <div className="col-md-3">
          <div className="portal-card text-center">
            <h2 className="fw-bold">
              {reports.length}
            </h2>

            <p className="text-muted m-0">
              Total Reports
            </p>
          </div>
        </div>

        <div className="col-md-3">
          <div className="portal-card text-center">
            <h2 className="fw-bold">
              {
                reports.filter(
                  (r) => r.status === "Tagged"
                ).length
              }
            </h2>

            <p className="text-muted m-0">
              Tagged
            </p>
          </div>
        </div>

        <div className="col-md-3">
          <div className="portal-card text-center">
            <h2 className="fw-bold">
              {
                reports.filter(
                  (r) => r.status === "Removed"
                ).length
              }
            </h2>

            <p className="text-muted m-0">
              Removed
            </p>
          </div>
        </div>

        <div className="col-md-3">
          <div className="portal-card text-center">
            <h2 className="fw-bold">
              {
                reports.filter(
                  (r) => r.status === "Closed"
                ).length
              }
            </h2>

            <p className="text-muted m-0">
              Closed
            </p>
          </div>
        </div>

      </div>

      {reports.length === 0 ? (

        <div className="portal-card text-center">
          <p className="fs-5 text-muted m-0">
            No reports found.
          </p>
        </div>

      ) : (

        <div className="row g-4">

          {reports.map((report) => (

            <div className="col-md-6" key={report.id}>

              <div className="portal-card h-100">

                <div className="d-flex justify-content-between align-items-start mb-3">

                  <h4 className="fw-bold">
                    Block {report.blockNumber}
                  </h4>

                  <span className={`badge ${getBadgeClass(report.status)}`}>
                    {report.status}
                  </span>

                </div>

                <p className="text-muted mb-1">
                  <strong>Report ID:</strong> {report.id}
                </p>

                <p className="text-muted mb-1">
                  <strong>Location:</strong> {report.location}
                </p>

                <p className="text-muted mb-3">
                  <strong>Description:</strong> {report.description}
                </p>

                {report.qrCodeImage && (
                  <div className="mt-3 mb-3">

                    <h6 className="fw-bold">
                      QR Code Tag
                    </h6>

                    <img
                      src={report.qrCodeImage}
                      alt="QR Code"
                      style={{
                        width: "160px",
                        height: "160px",
                        border: "1px solid #ccc",
                        padding: "8px",
                        borderRadius: "8px",
                        background: "white",
                      }}
                    />

                    <p className="text-muted small mt-2">
                      <strong>Scan URL:</strong>
                      <br />
                      {report.qrUrl}
                    </p>

                    {report.expiryDate && (
                      <p className="text-muted small">
                        <strong>Notice expires:</strong>{" "}
                        {report.expiryDate.toDate
                          ? report.expiryDate.toDate().toLocaleDateString()
                          : new Date(report.expiryDate).toLocaleDateString()}
                      </p>
                    )}

                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => window.print()}
                    >
                      Print QR Code
                    </button>

                  </div>
                )}

                <div className="d-flex flex-wrap gap-2">

                  <button
                    className="btn btn-info btn-sm text-white"
                    onClick={() =>
                      updateStatus(report.id, "Verified")
                    }
                  >
                    Mark Verified
                  </button>

                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() =>
                      updateStatus(report.id, "Tagged")
                    }
                  >
                    Mark Tagged
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      updateStatus(report.id, "Removed")
                    }
                  >
                    Mark Removed
                  </button>

                  <button
                    className="btn btn-success btn-sm"
                    onClick={() =>
                      updateStatus(report.id, "Closed")
                    }
                  >
                    Close Case
                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

      )}
    </div>
  );
}

export default Staff;