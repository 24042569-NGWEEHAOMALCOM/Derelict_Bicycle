import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

function Login() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectPath = location.state?.from?.pathname || "/staff";
  const sessionExpired = location.state?.sessionExpired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      navigate(redirectPath, { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      setMessage({
        type: "danger",
        text: "Invalid staff email or password.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auth.currentUser) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="container py-5">
      <div className="portal-card mx-auto" style={{ maxWidth: "620px" }}>
        <div className="mb-4">
          <p className="text-uppercase fw-semibold text-primary mb-2">
            Staff Access
          </p>

          <h1 className="fw-bold mb-3">
            Staff Login
          </h1>

          <p className="text-muted fs-5 mb-0">
            Sign in to access the staff dashboard and printable notices.
          </p>
        </div>

        {message && (
          <div className={`alert alert-${message.type}`} role="alert">
            {message.text}
          </div>
        )}

        {sessionExpired && !message && (
          <div className="alert alert-warning" role="alert">
            Your session expired due to inactivity. Please sign in again.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="staffEmail">
              Email
            </label>

            <input
              className="form-control form-control-lg"
              id="staffEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <label className="form-label" htmlFor="staffPassword">
              Password
            </label>

            <input
              className="form-control form-control-lg"
              id="staffPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="btn btn-primary btn-lg w-100"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
