// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your Firebase config (replace ==== with your actual values)
const firebaseConfig = {
  apiKey: "AIzaSyDLeWNO1PVB6BVfPezFl7VZqOFKNXqTntA",
  authDomain: "grocery-list-app-6402b.firebaseapp.com",
  projectId: "grocery-list-app-6402b",
  storageBucket: "grocery-list-app-6402b.firebasestorage.app",
  messagingSenderId: "260331662275",
  appId: "1:260331662275:web:6e815ad7a970430b5f6b76"
};

// Initialize Firebase (prevent multiple apps)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export Firestore & Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
