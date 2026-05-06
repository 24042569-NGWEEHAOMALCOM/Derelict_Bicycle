import { NavLink } from "react-router-dom";

function Navbar() {
  return (
    <nav className="main-navbar d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-3">
        <div className="logo-box">NS</div>
        <div>
          <h1 className="m-0 fw-bold">Nee Soon Town Council</h1>
          <p className="m-0 text-muted">Derelict Bicycle Management</p>
        </div>
      </div>

      <div className="d-flex gap-3 align-items-center">
        <NavLink className="nav-pill" to="/">⌂ Home</NavLink>
        <NavLink className="nav-pill" to="/resident">☻ Resident</NavLink>
        <NavLink className="nav-pill" to="/staff">▣ Staff</NavLink>
      </div>
    </nav>
  );
}

export default Navbar;