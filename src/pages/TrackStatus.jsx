import { useState } from "react";
import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

function TrackStatus() {
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState(null);

  const handleSearch = async () => {
    const querySnapshot = await getDocs(collection(db, "reports"));

    const foundReport = querySnapshot.docs.find(
      (doc) => doc.id === reportId
    );

    if (foundReport) {
      setReport({
        id: foundReport.id,
        ...foundReport.data(),
      });
    } else {
      alert("Report not found");
      setReport(null);
    }
  };

  return (
    <div>
      <h1>Track Report Status</h1>

      <input
        type="text"
        placeholder="Enter Report ID"
        value={reportId}
        onChange={(e) => setReportId(e.target.value)}
      />

      <button onClick={handleSearch}>
        Search
      </button>

      <br />
      <br />

      {report && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <h3>Report Found</h3>

          <p><strong>Report ID:</strong> {report.id}</p>
          <p><strong>Block:</strong> {report.blockNumber}</p>
          <p><strong>Location:</strong> {report.location}</p>
          <p><strong>Description:</strong> {report.description}</p>
          <p><strong>Status:</strong> {report.status}</p>
        </div>
      )}
    </div>
  );
}

export default TrackStatus;