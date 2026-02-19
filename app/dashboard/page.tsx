"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../src/firebase";
import { useRouter } from "next/navigation";
import { collection, addDoc, onSnapshot, doc, deleteDoc } from "firebase/firestore";

interface GroceryList {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [newList, setNewList] = useState("");
  const router = useRouter();

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch user lists
  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, `users/${user.uid}/lists`);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { name: string }),
      }));
      setLists(data);
    });
    return () => unsubscribe();
  }, [user]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  const createList = async () => {
    if (!newList.trim()) return;

    await addDoc(collection(db, `users/${user.uid}/lists`), {
      name: newList.trim(),
    });

    setNewList("");
  };

  const openList = (listId: string) => {
    router.push(`/list/${listId}`);
  };

  const deleteList = async (listId: string) => {
    await deleteDoc(doc(db, `users/${user.uid}/lists/${listId}`));
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
          type="text"
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

      <ul>
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex justify-between items-center mb-2 p-2 border rounded cursor-pointer hover:bg-gray-100"
          >
            <span onClick={() => openList(list.id)}>{list.name}</span>
            <button
              onClick={() => deleteList(list.id)}
              className="text-red-500 font-bold"
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
