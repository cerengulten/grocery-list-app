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
        if (!u) {
          router.push("/login");
          return;
        }
        setUser(u);

        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        const existing = snap.exists() ? (snap.data() as any).username : null;

        if (existing) router.push("/");
      } catch (e: any) {
        console.error("Setup auth check failed:", e);
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
        setError("Username must be 3–20 chars, lowercase letters/numbers/._ only.");
        return;
      }

      setSaving(true);

      const usernameRef = doc(db, "usernames", uname);
      const userRef = doc(db, "users", user.uid);

      await runTransaction(db, async (tx) => {
        const unameSnap = await tx.get(usernameRef);
        if (unameSnap.exists()) throw new Error("That username is taken.");

        tx.set(usernameRef, { uid: user.uid, createdAt: serverTimestamp() });
        tx.set(userRef, { username: uname, updatedAt: serverTimestamp() }, { merge: true });
      });

      router.push("/");
    } catch (e: any) {
      setError(e?.message || "Failed to set username.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="max-w-md mx-auto mt-20 p-4 border rounded shadow">
      <h1 className="text-2xl font-bold mb-2">Pick your username</h1>
      <p className="text-sm text-gray-600 mb-4">
        This will be used for sharing lists (like a handle).
      </p>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      <div className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. ceren_27"
          className="flex-1 border p-2 rounded"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button
          onClick={claimUsername}
          disabled={saving}
          className="bg-blue-500 text-white px-4 rounded disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}