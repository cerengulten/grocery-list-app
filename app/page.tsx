"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../src/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";

type GroceryList = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt?: any;
};

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string>("");

  const [lists, setLists] = useState<GroceryList[]>([]);
  const [newList, setNewList] = useState("");

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

  // 🔄 Realtime lists
  useEffect(() => {
    if (!user) return;

    const listsRef = collection(db, "lists");
    const q = query(
      listsRef,
      where("memberIds", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as GroceryList[];
        setLists(data);
      },
      (err) => {
        console.error("Lists snapshot error:", err);
        setAuthError(err?.message || "Failed to load lists");
      }
    );

    return () => unsub();
  }, [user]);

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

  const createList = async () => {
    const name = newList.trim();
    if (!name) return;

    await addDoc(collection(db, "lists"), {
      name,
      ownerId: user.uid,
      memberIds: [user.uid],
      createdAt: serverTimestamp(),
    });

    setNewList("");
  };

  const openList = (listId: string) => router.push(`/list/${listId}`);

  const deleteList = async (listId: string) => {
    await deleteDoc(doc(db, "lists", listId));
  };

  const logout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">📝 My Lists</h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-3 py-1 rounded"
        >
          Logout
        </button>
      </div>

      <div className="flex mb-4">
        <input
          value={newList}
          onChange={(e) => setNewList(e.target.value)}
          placeholder="New list name..."
          className="flex-1 border p-2 rounded-l"
        />
        <button
          onClick={createList}
          className="bg-blue-500 text-white px-4 rounded-r"
        >
          Create
        </button>
      </div>

      {lists.length === 0 ? (
        <p className="text-sm text-gray-500">No lists yet — create one ✨</p>
      ) : (
        <ul>
          {lists.map((list) => (
            <li
              key={list.id}
              className="flex justify-between items-center mb-2 p-2 border rounded hover:bg-gray-100"
            >
              <button
                onClick={() => openList(list.id)}
                className="text-left flex-1"
              >
                {list.name}
              </button>

              <button
                onClick={() => deleteList(list.id)}
                className="text-red-500 font-bold ml-3"
                title="Delete list"
              >
                X
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}