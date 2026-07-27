import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import AuthContext from "../context/AuthContext";

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.currentUser);
  const [checkingAuth, setCheckingAuth] = useState(() => !auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setCheckingAuth(false);
      },
      (error) => {
        console.error("Error checking staff access:", error);
        setUser(null);
        setCheckingAuth(false);
      }
    );

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, checkingAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
