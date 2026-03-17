"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../src/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit,
  arrayUnion,
} from "firebase/firestore";

type GroceryList = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt?: any;
};

type AppNotification = {
  id: string;
  type: string;
  listId?: string;
  listName?: string;
  leftUserId?: string;
  createdAt?: any;
  read?: boolean;
};

type Invitation = {
  id: string;
  listId: string;
  listName: string;
  fromUserId: string;
  fromUserEmail: string;
  toUserId: string; 
  status: "pending" | "accepted" | "declined";
  createdAt?: any;
};


export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string>("");

  const [lists, setLists] = useState<GroceryList[]>([]);
  const [newList, setNewList] = useState("");

  // Notification States 
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Invitation States 
  const [invitations, setInvitations] = useState<Invitation[]>([]);

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

  // Notification Listener
  useEffect(() => {
    if (!user) return;

    const notifRef = collection(db, "users", user.uid, "notifications");
    const q = query(notifRef, orderBy("createdAt", "desc"), limit(10));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as AppNotification[];

        setNotifications(data);
      },
      (err) => {
        console.error("Notifications snapshot error:", err);
      }
    );
    

    return () => unsub();
}, [user]);


  // Invitation Listener 
  useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "invitations"),
    where("toUserId", "==", user.uid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const invites: Invitation[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Invitation, "id">),
      }));
      setInvitations(invites);
    },
    (err) => {
      console.error("Invitations snapshot error:", err);
      setAuthError(err?.message || "Failed to load invitations");
    }
  );

  return () => unsubscribe();
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
  const markNotificationAsRead = async (notificationId: string) => {
  try {
    if (!user) return;

    await updateDoc(
      doc(db, "users", user.uid, "notifications", notificationId),
      {
        read: true,
      }
    );
  } catch (e) {
    console.error("Failed to mark notification as read:", e);
  }
};

const markAllNotificationsAsRead = async () => {
  try {
    if (!user) return;

    const unreadNotifications = notifications.filter((n) => !n.read);

    await Promise.all(
      unreadNotifications.map((n) =>
        updateDoc(doc(db, "users", user.uid, "notifications", n.id), {
          read: true,
        })
      )
    );
  } catch (e) {
    console.error("Failed to mark all notifications as read:", e);
  }
};
// to accept invitation 
const acceptInvitation = async (invitation: Invitation) => {
  try {
    if (!user) return;

    const invitationRef = doc(db, "invitations", invitation.id);
    const listRef = doc(db, "lists", invitation.listId);

    await updateDoc(listRef, {
      memberIds: arrayUnion(user.uid),
    });

    await updateDoc(invitationRef, {
      status: "accepted",
    });
  } catch (e) {
    console.error("Failed to accept invitation:", e);
  }
};
// to decline invitation
const declineInvitation = async (invitationId: string) => {
  try {
    if (!user) return;

    const invitationRef = doc(db, "invitations", invitationId);

    await updateDoc(invitationRef, {
      status: "declined",
    });
  } catch (e) {
    console.error("Failed to decline invitation:", e);
  }
};
const logout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-4">
      <div className="flex justify-between items-center mb-6 relative">
        <h1 className="text-3xl font-bold">📝 My Lists</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative border rounded px-3 py-1 bg-white"
            title="Notifications"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 px-1 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>

        {showNotifications && (
          <div className="absolute right-0 top-14 w-80 bg-white border rounded shadow-lg p-3 z-50">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Notifications</h2>

              {notifications.length > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-sm underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500">No notifications yet.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    onClick={() => markNotificationAsRead(notification.id)}
                    className={`border rounded p-2 cursor-pointer ${
                      notification.read ? "bg-gray-50" : "bg-yellow-50"
                    }`}
                  >
                    <p className="text-sm">
                      {notification.type === "member_left_list"
                        ? `${notification.leftUserId || "A member"} left ${notification.listName || "a list"}`
                        : "New notification"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Pending Invitations</h2>

        {invitations.length === 0 ? (
          <p className="text-sm text-gray-500">No pending invitations.</p>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="border rounded p-3 bg-gray-50"
              >
                <p className="text-sm mb-2">
                  <strong>{invitation.fromUserEmail}</strong> invited you to join{" "}
                  <strong>{invitation.listName}</strong>
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => acceptInvitation(invitation)}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => declineInvitation(invitation.id)}
                    className="bg-gray-300 px-3 py-1 rounded"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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