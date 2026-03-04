"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../src/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

type GroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  createdAt?: any;
};

export default function GroceryListPage() {
  const router = useRouter();
  const params = useParams();
  const listId = useMemo(() => {
    const raw = (params as any)?.listId;
    return typeof raw === "string" ? raw : null;
  }, [params]);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string>("");

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [listName, setListName] = useState("");

  // Share by username
  const [shareUsername, setShareUsername] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  // 🔐 Auth + username gate
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        setAuthError("");

        if (!u) {
          router.push("/login");
          return;
        }

        const userSnap = await getDoc(doc(db, "users", u.uid));
        const username = userSnap.exists()
          ? (userSnap.data() as any).username
          : null;

        if (!username) {
          router.push("/setup");
          return;
        }

        setUser(u);
      } catch (e: any) {
        console.error("Auth/username gate failed:", e);
        setAuthError(e?.message || "Auth check failed");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // 📛 Fetch list name + (optional) membership check
  useEffect(() => {
    if (!listId || !user) return;

    const fetchList = async () => {
      try {
        const listRef = doc(db, "lists", listId);
        const snap = await getDoc(listRef);

        if (!snap.exists()) {
          router.push("/");
          return;
        }

        const data = snap.data() as any;

        // Optional UX check (security should still be in Firestore rules)
        if (Array.isArray(data.memberIds) && !data.memberIds.includes(user.uid)) {
          setAuthError("You don't have access to this list.");
          return;
        }

        setListName((data.name as string) || "");
      } catch (e: any) {
        console.error("Fetch list failed:", e);
        setAuthError(e?.message || "Failed to load list");
      }
    };

    fetchList();
  }, [listId, user, router]);

  // 🔄 Realtime items
  useEffect(() => {
    if (!listId || !user) return;

    const itemsRef = collection(db, "lists", listId, "items");
    const q = query(itemsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data: GroceryItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GroceryItem, "id">),
        }));
        setItems(data);
      },
      (err) => {
        console.error("Items snapshot error:", err);
        setAuthError(err?.message || "Failed to load items");
      }
    );

    return () => unsub();
  }, [listId, user]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  if (authError) {
    return (
      <div className="max-w-md mx-auto mt-16 p-4">
        <p className="text-red-600 font-semibold">Something went wrong:</p>
        <pre className="text-xs mt-2 whitespace-pre-wrap">{authError}</pre>

        <button
          onClick={() => auth.signOut().then(() => router.push("/login"))}
          className="mt-4 bg-red-500 text-white px-3 py-1 rounded"
        >
          Go to login
        </button>
      </div>
    );
  }

  if (!user) return <p className="text-center mt-10">Redirecting...</p>;
  if (!listId) return <p className="text-center mt-10">List not found.</p>;

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;

    await addDoc(collection(db, "lists", listId, "items"), {
      name,
      checked: false,
      createdAt: serverTimestamp(),
    });

    setNewItem("");
  };

  const toggleItem = async (item: GroceryItem) => {
    await updateDoc(doc(db, "lists", listId, "items", item.id), {
      checked: !item.checked,
    });
  };

  const deleteItem = async (item: GroceryItem) => {
    await deleteDoc(doc(db, "lists", listId, "items", item.id));
  };

  const shareWithUsername = async () => {
    try {
      setShareError("");
      setShareLoading(true);

      const uname = shareUsername.trim().toLowerCase();
      if (!uname) return;

      const unameSnap = await getDoc(doc(db, "usernames", uname));
      if (!unameSnap.exists()) {
        setShareError("No user found with that username.");
        return;
      }

      const partnerUid = (unameSnap.data() as any).uid;

      if (partnerUid === user.uid) {
        setShareError("You can’t share with yourself 😄");
        return;
      }

      await updateDoc(doc(db, "lists", listId), {
        memberIds: arrayUnion(partnerUid),
      });

      setShareUsername("");
    } catch (e: any) {
      setShareError(e?.message || "Failed to share.");
    } finally {
      setShareLoading(false);
    }
  };

  const logout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={() => router.push("/")} className="text-sm underline mb-2">
            ← Back
          </button>
          <h1 className="text-3xl font-bold">🛒 {listName || "My List"}</h1>
        </div>

        <button onClick={logout} className="bg-red-500 text-white px-3 py-1 rounded">
          Logout
        </button>
      </div>

      {/* Share section */}
      <div className="mb-4 border p-3 rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Invite partner 💕</h2>

        <div className="flex gap-2">
          <input
            value={shareUsername}
            onChange={(e) => setShareUsername(e.target.value)}
            placeholder="Partner username (e.g. biscotti)"
            className="flex-1 border p-2 rounded"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            onClick={shareWithUsername}
            disabled={shareLoading}
            className="bg-green-500 text-white px-4 rounded disabled:opacity-60"
          >
            {shareLoading ? "Sharing..." : "Share"}
          </button>
        </div>

        {shareError && <p className="text-red-500 text-sm mt-2">{shareError}</p>}
      </div>

      {/* Add item */}
      <div className="flex mb-4">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new item..."
          className="flex-1 border p-2 rounded-l"
        />
        <button onClick={addItem} className="bg-blue-500 text-white px-4 rounded-r">
          Add
        </button>
      </div>

      {/* Items */}
      <ul>
        {items.map((item) => (
          <li key={item.id} className="flex justify-between items-center mb-2">
            <div>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item)}
                className="mr-2"
              />
              <span className={item.checked ? "line-through text-gray-400" : ""}>
                {item.name}
              </span>
            </div>

            <button
              onClick={() => deleteItem(item)}
              className="text-red-500 font-bold"
              title="Delete item"
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}