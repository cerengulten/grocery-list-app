"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../src/firebase";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}
function isValidUsername(u: string) {
  return /^[a-z0-9_.]{3,20}$/.test(u);
}

export default function SetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        if (!u) { router.push("/login"); return; }
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && (snap.data() as any).username) router.push("/");
      } catch (e: any) {
        setError(e?.message || "Failed to load setup");
      }
    });
    return () => unsub();
  }, [router]);

  const claimUsername = async () => {
    try {
      setError("");
      if (!user) return;
      const uname = normalizeUsername(username);
      if (!isValidUsername(uname)) {
        setError("Username must be 3–20 chars: lowercase letters, numbers, . or _");
        return;
      }
      setSaving(true);
      await runTransaction(db, async (tx) => {
        const unameSnap = await tx.get(doc(db, "usernames", uname));
        if (unameSnap.exists()) throw new Error("That username is taken.");
        tx.set(doc(db, "usernames", uname), { uid: user.uid, createdAt: serverTimestamp() });
        tx.set(doc(db, "users", user.uid), { username: uname, updatedAt: serverTimestamp() }, { merge: true });
      });
      router.push("/");
    } catch (e: any) {
      setError(e?.message || "Failed to set username.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cream)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--cream)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, #E8EDE0 0%, transparent 70%)", opacity: 0.8 }} />
        <div style={{ position: "absolute", bottom: "-8%", left: "-4%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, #F5E5DC 0%, transparent 70%)", opacity: 0.8 }} />
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        background: "var(--warm-white)", borderRadius: 24, padding: 40,
        width: 420, maxWidth: "100%",
        boxShadow: "0 20px 60px var(--shadow-lg)",
        animation: "slideIn 0.35s ease both",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏷️</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "var(--ink)" }}>
            Pick your username
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
            This is how others will find and invite you to shared lists.
          </p>
        </div>

        {/* Rules hint */}
        <div style={{ background: "var(--olive-pale)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "var(--olive-light)", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span>💡</span>
          <span>3–20 characters · lowercase letters, numbers, <code>.</code> and <code>_</code> only</span>
        </div>

        {error && (
          <div style={{ background: "#FDECEA", border: "1.5px solid #F5C6CB", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--red)" }}>
            {error}
          </div>
        )}

        {/* Username input */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14, userSelect: "none" }}>@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && claimUsername()}
              placeholder="your_handle"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: "100%", padding: "13px 16px 13px 30px",
                borderRadius: 12, border: "1.5px solid var(--border)",
                background: "var(--cream)", fontSize: 14,
                fontFamily: "'DM Sans', sans-serif", color: "var(--ink)",
                outline: "none", transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--olive)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <button
            onClick={claimUsername}
            disabled={saving}
            style={{
              padding: "13px 22px", borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              background: saving ? "var(--muted)" : "var(--olive)",
              color: "#fff", border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap", transition: "background 0.15s",
            }}
          >
            {saving ? "Saving…" : "Claim →"}
          </button>
        </div>

        {/* Live preview */}
        {username.trim().length > 0 && (
          <div style={{ marginTop: 14, padding: "8px 14px", background: "var(--cream)", borderRadius: 10, fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
            {isValidUsername(normalizeUsername(username))
              ? <><span style={{ color: "var(--olive)" }}>✓</span> <strong style={{ color: "var(--ink)" }}>@{normalizeUsername(username)}</strong> looks good!</>
              : <><span style={{ color: "var(--red)" }}>✗</span> Invalid format</>
            }
          </div>
        )}
      </div>
    </div>
  );
}
