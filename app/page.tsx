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

/* ─── Types ─────────────────────────────────────────────────── */
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

/* ─── Helpers ────────────────────────────────────────────────── */
const LIST_EMOJIS = ["🛒","🥦","🍕","🥩","🧃","🍰","🧺","🌿","🥗","🫙"];
const LIST_COLORS = ["#5C6B3A","#C4633A","#3A6B6B","#7A4F7A","#3A5A8A"];

function getListEmoji(name: string) {
  const seed = name.charCodeAt(0) || 0;
  return LIST_EMOJIS[seed % LIST_EMOJIS.length];
}
function getListColor(id: string) {
  const seed = id.charCodeAt(0) || 0;
  return LIST_COLORS[seed % LIST_COLORS.length];
}
function getInitials(email: string) {
  return email.split("@")[0].slice(0, 2).toUpperCase();
}
function formatTime(ts: any): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate() as Date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Toast component ────────────────────────────────────────── */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed", bottom: 28, right: 28, zIndex: 600,
        background: "var(--ink)", color: "#fff",
        padding: "12px 20px", borderRadius: 12,
        fontSize: 13, fontWeight: 500,
        boxShadow: "0 6px 24px var(--shadow-lg)",
        animation: "toastIn 0.3s ease both",
        display: "flex", alignItems: "center", gap: 8,
      }}
    >
      {message}
    </div>
  );
}

/* ─── New List Modal ─────────────────────────────────────────── */
function NewListModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, emoji: string) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛒");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), emoji);
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(30,30,20,0.42)", backdropFilter: "blur(3px)",
        zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.2s ease both",
      }}
    >
      <div
        style={{
          background: "var(--warm-white)", borderRadius: 20,
          padding: 32, width: 420, maxWidth: "90vw",
          boxShadow: "0 20px 60px var(--shadow-lg)",
          animation: "slideIn 0.25s ease both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Create New List</h2>
          <button onClick={onClose} style={styles.modalClose}>✕</button>
        </div>

        <label style={styles.modalLabel}>List name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="e.g. Weekly Groceries"
          style={styles.modalInput}
        />

        <label style={{ ...styles.modalLabel, marginTop: 16 }}>Choose an emoji</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {LIST_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              style={{
                width: 38, height: 38, borderRadius: 10, fontSize: 20,
                border: `2px solid ${e === emoji ? "var(--olive)" : "transparent"}`,
                background: e === emoji ? "var(--olive-pale)" : "var(--cream)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {e}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={handleCreate} style={styles.btnOlive}>Create List</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [lists, setLists] = useState<GroceryList[]>([]);
  const [newList, setNewList] = useState("");
  const [showNewListModal, setShowNewListModal] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [activeView, setActiveView] = useState<"notifications" | "invitations">("notifications");
  const [notifFilter, setNotifFilter] = useState<"all" | "invite" | "change">("all");

  const [toast, setToast] = useState("");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingInviteCount = invitations.length;
  const totalBadge = unreadCount + pendingInviteCount;

  const showToast = (msg: string) => setToast(msg);

  /* Auth */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        setAuthError("");
        if (!u) { router.push("/login"); return; }
        const snap = await getDoc(doc(db, "users", u.uid));
        const username = snap.exists() ? (snap.data() as any).username : null;
        if (!username) { router.push("/setup"); return; }
        setUser(u);
      } catch (e: any) {
        setAuthError(e?.message || "Auth check failed");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  /* Lists */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "lists"),
      where("memberIds", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setLists(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as GroceryList[]);
    }, (err) => setAuthError(err.message));
  }, [user]);

  /* Notifications */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AppNotification[]);
    });
  }, [user]);

  /* Invitations */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "invitations"),
      where("toUserId", "==", user.uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setInvitations(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invitation, "id">) })));
    }, (err) => setAuthError(err.message));
  }, [user]);

  if (loading) return <FullPageLoading />;
  if (authError) return <ErrorScreen message={authError} onBack={() => auth.signOut().then(() => router.push("/login"))} />;
  if (!user) return <FullPageLoading label="Redirecting…" />;

  /* Actions */
  const createList = async (name: string, emoji: string) => {
    await addDoc(collection(db, "lists"), {
      name: `${emoji} ${name}`,
      ownerId: user.uid,
      memberIds: [user.uid],
      createdAt: serverTimestamp(),
    });
    setShowNewListModal(false);
    showToast(`🎉 "${name}" created!`);
  };

  const deleteList = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "lists", id));
    showToast(`🗑️ "${name}" deleted`);
  };

  const markAllRead = async () => {
    await Promise.all(
      notifications.filter((n) => !n.read).map((n) =>
        updateDoc(doc(db, "users", user.uid, "notifications", n.id), { read: true })
      )
    );
  };

  const markRead = async (id: string) => {
    await updateDoc(doc(db, "users", user.uid, "notifications", id), { read: true });
  };

  const acceptInvitation = async (inv: Invitation) => {
    await updateDoc(doc(db, "lists", inv.listId), { memberIds: arrayUnion(user.uid) });
    await updateDoc(doc(db, "invitations", inv.id), { status: "accepted" });
    showToast("✅ Joined the list!");
  };

  const declineInvitation = async (id: string) => {
    await updateDoc(doc(db, "invitations", id), { status: "declined" });
    showToast("❌ Invitation declined");
  };

  const logout = async () => { await auth.signOut(); router.push("/login"); };

  /* Filtered notifications */
  const filteredNotifs = notifications.filter((n) => {
    if (notifFilter === "all") return true;
    if (notifFilter === "invite") return n.type?.includes("invite") || n.type?.includes("invitation");
    return n.type?.includes("left") || n.type?.includes("change") || n.type?.includes("member");
  });

  /* ── Render ── */
  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gridTemplateRows: "64px 1fr", height: "100vh", background: "var(--cream)" }}>

      {/* ── Topbar ── */}
      <header style={styles.topbar}>
        <div style={styles.topbarLogo}>
          <span>🛒</span> Pantry
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setActiveView(activeView === "notifications" ? "invitations" : "notifications")}
              style={styles.notifBtn}
              title="Notifications"
            >
              🔔
              {totalBadge > 0 && (
                <span style={styles.notifBadge}>{totalBadge}</span>
              )}
            </button>
          </div>
          <div style={styles.avatar}>
            {getInitials(user.email || "??")}
          </div>
          <button onClick={logout} style={styles.btnLogout}>Logout</button>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav style={styles.sidebar}>
        <div style={styles.sidebarLabel}>My Lists</div>
        {lists.map((list, i) => (
          <div
            key={list.id}
            style={{
              margin: "0 12px", borderRadius: 10, padding: "10px 14px",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "space-between",
              background: "transparent",
              transition: "background 0.15s",
              animation: `slideIn 0.28s ease ${i * 0.04}s both`,
            }}
            className="list-sidebar-item"
            onClick={() => router.push(`/list/${list.id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--olive-pale)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{getListEmoji(list.name)}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{list.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{list.memberIds.length} member{list.memberIds.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteList(list.id, list.name); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "2px 6px", borderRadius: 6, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
              title="Delete list"
            >✕</button>
          </div>
        ))}
        <button
          onClick={() => setShowNewListModal(true)}
          style={styles.sidebarAddBtn}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--olive)"; e.currentTarget.style.color = "var(--olive)"; e.currentTarget.style.background = "var(--olive-pale)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "none"; }}
        >
          ➕ New list…
        </button>
      </nav>

      {/* ── Main ── */}
      <main style={{ padding: "32px 40px", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={styles.pageTitle}>Good morning 👋</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
              {pendingInviteCount > 0 ? ` · ${pendingInviteCount} pending invite${pendingInviteCount > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["notifications", "invitations"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                style={{
                  padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: `1.5px solid ${activeView === v ? "var(--olive)" : "var(--border)"}`,
                  background: activeView === v ? "var(--olive)" : "none",
                  color: activeView === v ? "#fff" : "var(--muted)",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {v === "invitations" && pendingInviteCount > 0 && (
                  <span style={{ background: "var(--terracotta)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {pendingInviteCount}
                  </span>
                )}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Notifications view ── */}
        {activeView === "notifications" && (
          <div style={{ animation: "fadeIn 0.2s ease both" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {(["all", "invite", "change"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setNotifFilter(f)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${notifFilter === f ? "var(--olive)" : "var(--border)"}`,
                      background: notifFilter === f ? "var(--olive)" : "none",
                      color: notifFilter === f ? "#fff" : "var(--muted)",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ fontSize: 12, color: "var(--olive)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
                  Mark all as read
                </button>
              )}
            </div>

            {filteredNotifs.length === 0 ? (
              <EmptyState icon="🎉" title="All caught up!" text="No notifications here." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredNotifs.map((n, i) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      background: "var(--warm-white)",
                      border: `1.5px solid ${n.read ? "var(--border)" : "var(--terracotta)"}`,
                      borderLeft: n.read ? "1.5px solid var(--border)" : "3.5px solid var(--terracotta)",
                      borderRadius: 14, padding: "16px 20px",
                      display: "flex", alignItems: "flex-start", gap: 14,
                      cursor: "pointer", transition: "box-shadow 0.2s, transform 0.15s",
                      animation: `slideIn 0.28s ease ${i * 0.04}s both`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px var(--shadow)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: getListColor(n.listId || n.id), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 14 }}>
                      {n.type === "member_left_list" ? "👋" : "🔔"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: "var(--ink-light)", lineHeight: 1.5 }}>
                        {n.type === "member_left_list"
                          ? <><strong>{n.leftUserId || "A member"}</strong> left <strong>{n.listName || "a list"}</strong></>
                          : "New notification"}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{formatTime(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--terracotta)", flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Invitations view ── */}
        {activeView === "invitations" && (
          <div style={{ animation: "fadeIn 0.2s ease both" }}>
            {invitations.length === 0 ? (
              <EmptyState icon="📬" title="No pending invites" text="When someone invites you to a list, it'll appear here." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {invitations.map((inv, i) => (
                  <div
                    key={inv.id}
                    style={{
                      background: "var(--warm-white)",
                      border: "1.5px solid var(--border)",
                      borderLeft: "3.5px solid var(--terracotta)",
                      borderRadius: 14, padding: "16px 20px",
                      display: "flex", alignItems: "flex-start", gap: 14,
                      animation: `slideIn 0.28s ease ${i * 0.04}s both`,
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--terracotta)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 14 }}>
                      {getInitials(inv.fromUserEmail)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: "var(--ink-light)", lineHeight: 1.5 }}>
                        <strong>{inv.fromUserEmail}</strong> invited you to join <strong>"{inv.listName}"</strong>
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => acceptInvitation(inv)} style={styles.btnAccept}>Accept</button>
                        <button onClick={() => declineInvitation(inv.id)} style={styles.btnDecline}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
                        >Decline</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals & Toast */}
      {showNewListModal && (
        <NewListModal onClose={() => setShowNewListModal(false)} onCreate={createList} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}

/* ─── Reusable small components ───────────────────────────────── */
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "var(--ink-light)", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function FullPageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cream)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12, animation: "slideIn 0.5s ease" }}>🛒</div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{label}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cream)" }}>
      <div style={{ background: "var(--warm-white)", borderRadius: 16, padding: 32, maxWidth: 480, width: "90vw", boxShadow: "0 8px 32px var(--shadow)" }}>
        <p style={{ color: "var(--red)", fontWeight: 600, marginBottom: 12 }}>Something went wrong</p>
        <pre style={{ fontSize: 12, color: "var(--ink-light)", whiteSpace: "pre-wrap", marginBottom: 20 }}>{message}</pre>
        <button onClick={onBack} style={styles.btnLogout}>Go to login</button>
      </div>
    </div>
  );
}

/* ─── Shared styles object ───────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  topbar: {
    gridColumn: "1/-1",
    background: "var(--warm-white)",
    borderBottom: "1.5px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 28px", position: "relative", zIndex: 100,
  },
  topbarLogo: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22, fontWeight: 700, color: "var(--olive)",
    letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8,
  },
  notifBtn: {
    position: "relative", background: "none", border: "none", cursor: "pointer",
    width: 38, height: 38, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, color: "var(--ink-light)",
  },
  notifBadge: {
    position: "absolute", top: 4, right: 4,
    width: 16, height: 16, background: "var(--terracotta)", color: "#fff",
    borderRadius: "50%", fontSize: 9, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "2px solid var(--warm-white)",
  },
  avatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: "var(--olive)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 600, cursor: "default",
  },
  sidebar: {
    background: "var(--warm-white)",
    borderRight: "1.5px solid var(--border)",
    padding: "24px 0", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 4,
  },
  sidebarLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: "1.4px",
    textTransform: "uppercase", color: "var(--muted)",
    padding: "0 24px 8px",
  },
  sidebarAddBtn: {
    margin: "10px 12px 0",
    padding: "10px 14px",
    border: "1.5px dashed var(--border)",
    borderRadius: 10, background: "none", cursor: "pointer",
    fontSize: 13, color: "var(--muted)", fontFamily: "'DM Sans', sans-serif",
    display: "flex", alignItems: "center", gap: 8,
    transition: "all 0.2s",
  },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 32, fontWeight: 700, color: "var(--ink)",
  },
  modalLabel: {
    display: "block", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.8px", color: "var(--muted)",
    textTransform: "uppercase", marginBottom: 8,
  },
  modalInput: {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid var(--border)", background: "var(--cream)",
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "var(--ink)",
    outline: "none",
  },
  modalClose: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 18, color: "var(--muted)", borderRadius: 8, padding: "4px 8px",
  },
  btnOlive: {
    flex: 1, padding: "12px 20px", borderRadius: 12,
    fontSize: 14, fontWeight: 600,
    background: "var(--olive)", color: "#fff", border: "none",
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    transition: "background 0.15s",
  },
  btnAccept: {
    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: "var(--olive)", color: "#fff", border: "none",
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  btnDecline: {
    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: "none", color: "var(--muted)",
    border: "1.5px solid var(--border)", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
  },
  btnLogout: {
    padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
    background: "none", color: "var(--muted)",
    border: "1.5px solid var(--border)", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};
