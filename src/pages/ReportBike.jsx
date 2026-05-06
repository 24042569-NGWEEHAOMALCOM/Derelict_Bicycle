import { useState } from "react";

import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

function ReportBike() {
  const [blockNumber, setBlockNumber] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "reports"), {
        blockNumber,
        location,
        description,
        status: "Reported",
        createdAt: new Date(),
      });

      alert("Report submitted successfully!");

      setBlockNumber("");
      setLocation("");
      setDescription("");

    } catch (error) {
      console.error("Error adding report: ", error);
    }
  };

  return (
    <div>
      <h1>Report Abandoned Bicycle</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Block Number</label>
          <br />
          <input
            type="text"
            value={blockNumber}
            onChange={(e) => setBlockNumber(e.target.value)}
          />
        </div>

        <br />

        <div>
          <label>Location</label>
          <br />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <br />

        <div>
          <label>Description</label>
          <br />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <br />

        <button type="submit">Submit Report</button>
      </form>
    </div>
  );
}

export default ReportBike;