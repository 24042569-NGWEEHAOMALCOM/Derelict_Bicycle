import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import useAuth from "../hooks/useAuth";

function Navbar() {
  const navigate = useNavigate();
  const { user, checkingAuth } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <nav className="main-navbar d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-3">
        <div className="logo-box">NS</div>
        <div>
          <h1 className="m-0 fw-bold">Nee Soon Town Council</h1>
          <p className="m-0 text-muted">Bicycle Management</p>
        </div>
      </div>

      <div className="d-flex gap-3 align-items-center">
        <NavLink className="nav-pill" to="/">Home</NavLink>
        <NavLink className="nav-pill" to="/resident">Resident</NavLink>

        {user ? (
          <>
            <NavLink className="nav-pill" to="/staff">
              Staff Dashboard
            </NavLink>
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : !checkingAuth ? (
          <NavLink className="nav-pill" to="/login">Staff Login</NavLink>
        ) : (
          <span className="nav-pill text-muted" aria-label="Checking staff session">
            Staff
          </span>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
