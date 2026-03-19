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
    const unsub = auth.onAuthStateChanged((u) => { if (u) router.push("/"); });
    return () => unsub();
  }, [router]);

  const loginWithGoogle = async () => {
    try {
      setError(""); setLoading(true);
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/");
    } catch (e: any) {
      setError(friendlyAuthError(e?.code || e?.message));
    } finally { setLoading(false); }
  };

  const submitEmailPassword = async () => {
    if (!email.trim() || !password) { setError("Please enter email and password."); return; }
    try {
      setError(""); setLoading(true);
      if (mode === "login") await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.push("/");
    } catch (e: any) {
      setError(friendlyAuthError(e?.code || e?.message));
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--cream)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      {/* Decorative background blobs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, #E8EDE0 0%, transparent 70%)", opacity: 0.8 }} />
        <div style={{ position: "absolute", bottom: "-8%", right: "-4%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, #F5E5DC 0%, transparent 70%)", opacity: 0.8 }} />
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        background: "var(--warm-white)",
        borderRadius: 24, padding: 40,
        width: 420, maxWidth: "100%",
        boxShadow: "0 20px 60px var(--shadow-lg)",
        animation: "slideIn 0.35s ease both",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "var(--olive)", letterSpacing: -0.5 }}>
            Pantry
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {mode === "login" ? "Welcome back 👋" : "Create your account to get started."}
          </p>
        </div>

        {error && (
          <div style={{ background: "#FDECEA", border: "1.5px solid #F5C6CB", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--red)" }}>
            {error}
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "var(--cream)", borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setError(""); setMode(m); }}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s",
                background: mode === m ? "var(--warm-white)" : "transparent",
                color: mode === m ? "var(--ink)" : "var(--muted)",
                boxShadow: mode === m ? "0 2px 8px var(--shadow)" : "none",
              }}
            >
              {m === "login" ? "Login" : "Sign up"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--olive)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--olive)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            onKeyDown={(e) => e.key === "Enter" && submitEmailPassword()}
          />
          <button
            onClick={submitEmailPassword}
            disabled={loading}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              background: loading ? "var(--muted)" : "var(--olive)",
              color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s",
            }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.5px" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Google */}
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12,
            fontSize: 14, fontWeight: 500,
            background: "var(--warm-white)",
            border: "1.5px solid var(--border)",
            color: "var(--ink-light)", cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--olive)"; e.currentTarget.style.boxShadow = "0 2px 12px var(--shadow)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.6 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.6 29.3 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z"/>
            <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 34.9 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.6 5.1C9.9 39.5 16.5 43.5 24 43.5z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.1-2.2 3.9-4 5.1l6.2 5.2c3.6-3.4 5.9-8.4 5.9-14.3 0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        {/* Footer note for signup */}
        {mode === "signup" && (
          <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
            After signing up, you'll pick a username on the next step.
          </p>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 12,
  border: "1.5px solid var(--border)", background: "var(--cream)",
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "var(--ink)",
  outline: "none", transition: "border-color 0.15s",
};
