"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../src/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

function friendlyAuthError(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("auth/invalid-email")) return "That email looks invalid.";
  if (m.includes("auth/user-not-found")) return "No account found with that email.";
  if (m.includes("auth/wrong-password")) return "Wrong password.";
  if (m.includes("auth/email-already-in-use")) return "This email is already in use.";
  if (m.includes("auth/weak-password")) return "Password should be at least 6 characters.";
  if (m.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  return msg || "Authentication failed.";
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) router.push("/");
    });
    return () => unsub();
  }, [router]);

  const loginWithGoogle = async () => {
    try {
      setError("");
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (e: any) {
      console.error(e);
      setError(friendlyAuthError(e?.code || e?.message));
    } finally {
      setLoading(false);
    }
  };

  const submitEmailPassword = async () => {
    const e = email.trim();
    const p = password;

    if (!e || !p) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, e, p);
      } else {
        await createUserWithEmailAndPassword(auth, e, p);
      }

      router.push("/");
    } catch (e: any) {
      console.error(e);
      setError(friendlyAuthError(e?.code || e?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow-sm">
      <h1 className="text-2xl font-bold mb-2">
        {mode === "login" ? "Login" : "Create account"}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        {mode === "login"
          ? "Welcome back 👋"
          : "Make an account, then pick your username on the next step."}
      </p>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* Email/password */}
      <div className="space-y-3 mb-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full border p-2 rounded"
          autoComplete="email"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          type="password"
          className="w-full border p-2 rounded"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button
          onClick={submitEmailPassword}
          disabled={loading}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Login"
            : "Sign up"}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="h-px bg-gray-200 flex-1" />
        <span className="text-xs text-gray-500">OR</span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      {/* Google */}
      <button
        onClick={loginWithGoogle}
        disabled={loading}
        className="w-full border px-4 py-2 rounded disabled:opacity-60"
      >
        Continue with Google
      </button>

      {/* Toggle mode */}
      <div className="text-sm mt-4">
        {mode === "login" ? (
          <p>
            Don’t have an account?{" "}
            <button
              className="underline"
              onClick={() => {
                setError("");
                setMode("signup");
              }}
            >
              Sign up
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <button
              className="underline"
              onClick={() => {
                setError("");
                setMode("login");
              }}
            >
              Login
            </button>
          </p>
        )}
      </div>
    </div>
  );
}