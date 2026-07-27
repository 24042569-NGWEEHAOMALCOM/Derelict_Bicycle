import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase/firebase";
import { useIdleSessionTimeout } from "../utils/sessionTimeout";
import useAuth from "../hooks/useAuth";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, checkingAuth } = useAuth();

  useIdleSessionTimeout(user, auth, navigate);

  if (checkingAuth) {
    return (
      <div className="container py-5">
        <div className="portal-card text-center">
          <h1 className="fw-bold h3">
            Checking staff access...
          </h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}

export default ProtectedRoute;
