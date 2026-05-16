import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Resident from "./pages/Resident";
import Staff from "./pages/Staff";
import ReportBike from "./pages/ReportBike";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";
import QRPage from "./pages/QRPage";
import ScanQRCode from "./pages/ScanQRCode";
import ClaimBike from "./pages/ClaimBike";
import ReportNotAbandoned from "./pages/ReportNotAbandoned";
import PrintNotice from "./pages/PrintNotice";
import Login from "./pages/Login";
import AcknowledgeParking from "./pages/AcknowledgeParking";

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resident" element={<Resident />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route path="/report" element={<ReportBike />} />
        <Route
          path="/report/improper-parking"
          element={<ReportBike reportType="improperParking" />}
        />
        <Route path="/scan" element={<ScanQRCode />} />
        <Route path="/qr/:id" element={<QRPage />} />
        <Route
          path="/notice/:id"
          element={
            <ProtectedRoute>
              <PrintNotice />
            </ProtectedRoute>
          }
        />
        <Route path="/claim/:id" element={<ClaimBike />} />
        <Route path="/not-abandoned/:id" element={<ReportNotAbandoned />} />
        <Route path="/acknowledge/:id" element={<AcknowledgeParking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
