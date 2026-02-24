"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../src/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";

interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
}

export default function GroceryListPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params.listId;
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [listName, setListName] = useState("");

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
  if (!user || !listId) return;

  const fetchListName = async () => {
    const docRef = doc(db, `users/${user.uid}/lists/${listId}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      setListName(docSnap.data().name);
    }
  };

  fetchListName();
}, [user, listId]);

  // Firestore listener for items
  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, `users/${user.uid}/lists/${listId}/items`);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<GroceryItem, "id">),
      }));
      setItems(data);
    });
    return () => unsubscribe();
  }, [user, listId]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  const addItem = async () => {
    if (!newItem.trim()) return;
    await addDoc(collection(db, `users/${user.uid}/lists/${listId}/items`), {
      name: newItem,
      checked: false,
    });
    setNewItem("");
  };

  const toggleItem = async (item: GroceryItem) => {
    const docRef = doc(db, `users/${user.uid}/lists/${listId}/items/${item.id}`);
    await updateDoc(docRef, { checked: !item.checked });
  };

  const deleteItem = async (item: GroceryItem) => {
    const docRef = doc(db, `users/${user.uid}/lists/${listId}/items/${item.id}`);
    await deleteDoc(docRef);
  };

  const logout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🛒 {listName || "Loading..." }</h1>
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
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new item..."
          className="flex-1 border p-2 rounded-l"
        />
        <button
          onClick={addItem}
          className="bg-blue-500 text-white px-4 rounded-r"
        >
          Add
        </button>
      </div>

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
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}