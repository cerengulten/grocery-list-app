"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../src/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
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
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [newList, setNewList] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const listsRef = collection(db, "lists");
    const q = query(
      listsRef,
      where("memberIds", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setLists(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });

    return () => unsub();
  }, [user]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

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
    // simple: only delete if you're owner in rules (we'll do rules next)
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
        <button onClick={logout} className="bg-red-500 text-white px-3 py-1 rounded">
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
        <button onClick={createList} className="bg-blue-500 text-white px-4 rounded-r">
          Create
        </button>
      </div>

      <ul>
        {lists.map((list) => (
          <li key={list.id} className="flex justify-between items-center mb-2 p-2 border rounded hover:bg-gray-100">
            <button onClick={() => openList(list.id)} className="text-left flex-1">
              {list.name}
            </button>
            <button onClick={() => deleteList(list.id)} className="text-red-500 font-bold ml-3">
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}