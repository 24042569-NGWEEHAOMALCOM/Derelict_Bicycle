import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Resident from "./pages/Resident";
import Staff from "./pages/Staff";
import ReportBike from "./pages/ReportBike";
import TrackStatus from "./pages/TrackStatus";
import Navbar from "./components/Navbar";
import "./App.css";
import QRPage from "./pages/QRPage";
import ClaimBike from "./pages/ClaimBike";
import ReportNotAbandoned from "./pages/ReportNotAbandoned";

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resident" element={<Resident />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/report" element={<ReportBike />} />
        <Route path="/track" element={<TrackStatus />} />
        <Route path="/qr/:id" element={<QRPage />} />
        <Route path="/claim/:id" element={<ClaimBike />} />
        <Route path="/not-abandoned/:id" element={<ReportNotAbandoned />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;