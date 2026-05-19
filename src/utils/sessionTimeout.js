import { useEffect } from "react";
import { signOut } from "firebase/auth";

const DEFAULT_TIMEOUT_MINUTES = 15;
const ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
  "visibilitychange",
];

function getSessionTimeoutMs() {
  const configuredMinutes = Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES);
  const timeoutMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : DEFAULT_TIMEOUT_MINUTES;

  return timeoutMinutes * 60 * 1000;
}

export function useIdleSessionTimeout(user, auth, navigate) {
  useEffect(() => {
    if (!user) return undefined;

    let timeoutId;

    const expireSession = async () => {
      await signOut(auth);
      navigate("/login", {
        replace: true,
        state: { sessionExpired: true },
      });
    };

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(expireSession, getSessionTimeoutMs());
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer);
    });

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [auth, navigate, user]);
}
