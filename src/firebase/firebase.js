// Initialize Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApgYWAJEI9yX0gm-T6n0vWfg4q0q_axLE",
  authDomain: "derelict-bicycle-system.firebaseapp.com",
  projectId: "derelict-bicycle-system",
  storageBucket: "derelict-bicycle-system.firebasestorage.app",
  messagingSenderId: "1023449299442",
  appId: "1:1023449299442:web:8ed9531d887ca01d9e936b",
  measurementId: "G-Y6VHE7WTL1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
