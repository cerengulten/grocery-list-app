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
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDocs,
  arrayUnion
} from "firebase/firestore";

interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  createdAt?: any;
}

export default function GroceryListPage() {
  const router = useRouter();
  const params = useParams<{ listId: string }>();
  const listId = params?.listId;

  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [listName, setListName] = useState("");
  // Couple Mode states  
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState("");

  // 🔐 Auth listener
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

  // 📛 Fetch list name from GLOBAL lists collection
  useEffect(() => {
    if (!listId) return;

    const fetchList = async () => {
      const listRef = doc(db, "lists", listId);
      const snap = await getDoc(listRef);

      if (snap.exists()) {
        setListName((snap.data() as any).name || "");
      } else {
        router.push("/");
      }
    };

    fetchList();
  }, [listId, router]);

  // 🔄 Realtime items listener
  useEffect(() => {
    if (!listId) return;

    const itemsRef = collection(db, "lists", listId, "items");
    const q = query(itemsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<GroceryItem, "id">),
      }));
      setItems(data);
    });

    return () => unsub();
  }, [listId]);

  if (!user) return <p className="text-center mt-10">Loading...</p>;
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
    const itemRef = doc(db, "lists", listId, "items", item.id);
    await updateDoc(itemRef, { checked: !item.checked });
  };

  const deleteItem = async (item: GroceryItem) => {
    const itemRef = doc(db, "lists", listId, "items", item.id);
    await deleteDoc(itemRef);
  };

  const logout = async () => {
    await auth.signOut();
    router.push("/login");
  };
  // share mode function 
  const shareWithEmail = async () => {
  try {
    setShareError("");

    const email = shareEmail.trim().toLowerCase();
    if (!email) return;

    // 1️⃣ Find user by email
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) {
      setShareError("No user found with this email.");
      return;
    }

    const partnerUid = snap.docs[0].id;

    // 2️⃣ Add them to memberIds
    await updateDoc(doc(db, "lists", listId), {
      memberIds: arrayUnion(partnerUid),
    });

    setShareEmail("");
  } catch (err: any) {
    setShareError(err.message);
  }
};

  return (
    <div className="max-w-md mx-auto mt-16 p-4">
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
      <div className="mb-4 border p-3 rounded bg-black-50">
    <h2 className="font-semibold mb-2">Share this list 💞</h2>

    <div className="flex gap-2">
      <input
        type="email"
        placeholder="Partner email..."
        value={shareEmail}
        onChange={(e) => setShareEmail(e.target.value)}
        className="flex-1 border p-2 rounded"
      />
      <button
        onClick={shareWithEmail}
        className="bg-green-500 text-white px-4 rounded"
      >
        Share
      </button>
    </div>

    {shareError && (
      <p className="text-red-500 text-sm mt-2">{shareError}</p>
    )}
    </div>
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