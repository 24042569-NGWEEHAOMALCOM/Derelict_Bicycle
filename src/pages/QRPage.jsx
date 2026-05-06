import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function QRPage() {
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportRef = doc(db, "reports", id);

        const reportSnap = await getDoc(reportRef);

        if (reportSnap.exists()) {
          setReport({
            id: reportSnap.id,
            ...reportSnap.data(),
          });
        }

        setLoading(false);

      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="container py-5">
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container py-5">
        <h2>Report not found.</h2>
      </div>
    );
  }

  const expiryDate = report.expiryDate?.toDate
    ? report.expiryDate.toDate()
    : new Date(report.expiryDate);

  const today = new Date();

  const isExpired = today > expiryDate;

  return (
    <div className="container py-5">

      <div className="portal-card">

        <h1 className="fw-bold mb-4">
          Bicycle Notice Information
        </h1>

        <p className="fs-5">
          <strong>Report ID:</strong> {report.id}
        </p>

        <p className="fs-5">
          <strong>Block:</strong> {report.blockNumber}
        </p>

        <p className="fs-5">
          <strong>Location:</strong> {report.location}
        </p>

        <p className="fs-5">
          <strong>Status:</strong> {report.status}
        </p>

        <p className="fs-5">
          <strong>Notice Expiry Date:</strong>{" "}
          {expiryDate.toLocaleDateString()}
        </p>

        <div className="mt-4">

          {isExpired ? (
            <div className="alert alert-danger">
              Notice period has expired. Bicycle may be removed by Town Council.
            </div>
          ) : (
            <div className="alert alert-warning">
              Bicycle is currently under notice period.
            </div>
          )}

        </div>

        <div className="d-flex gap-3 mt-4">

          <a href={`/claim/${report.id}`} className="btn btn-success">
            Claim Bicycle
            </a>

          <a href={`/not-abandoned/${report.id}`} className="btn btn-outline-secondary">
            Report Not Abandoned
            </a>

        </div>

      </div>

    </div>
  );
}

export default QRPage;