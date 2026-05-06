import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Resident from "./pages/Resident";
import Staff from "./pages/Staff";
import ReportBike from "./pages/ReportBike";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resident" element={<Resident />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/report" element={<ReportBike />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;