import { createContext } from "react";

const AuthContext = createContext({
  user: null,
  checkingAuth: true,
});

export default AuthContext;
