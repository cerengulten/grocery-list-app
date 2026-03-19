"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  arrayRemove,
  writeBatch,
  setDoc,
} from "firebase/firestore";

type GroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  createdAt?: any;
};

/* ─── Toast ─────────────────────────────────────────────────── */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 600,
      background: "var(--ink)", color: "#fff", padding: "12px 20px",
      borderRadius: 12, fontSize: 13, fontWeight: 500,
      boxShadow: "0 6px 24px var(--shadow-lg)",
      animation: "toastIn 0.3s ease both",
      display: "flex", alignItems: "center", gap: 8,
    }}>{message}</div>
  );
}

/* ─── Invite Modal ───────────────────────────────────────────── */
function InviteModal({
  onClose,
  onInvite,
  shareLoading,
  shareError,
}: {
  onClose: () => void;
  onInvite: (username: string) => void;
  shareLoading: boolean;
  shareError: string;
}) {
  const [val, setVal] = useState("");
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
      <div style={{
        background: "var(--warm-white)", borderRadius: 20, padding: 32,
        width: 420, maxWidth: "90vw",
        boxShadow: "0 20px 60px var(--shadow-lg)",
        animation: "slideIn 0.25s ease both",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Invite to List</h2>
          <button onClick={onClose} style={mStyles.modalClose}>✕</button>
        </div>

        <label style={mStyles.modalLabel}>Partner's username</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>@</span>
            <input
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onInvite(val)}
              placeholder="username"
              autoCapitalize="none" autoCorrect="off"
              style={{ ...mStyles.input, paddingLeft: 30 }}
              onFocus={(e) => (e.target.style.borderColor = "var(--olive)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <button
            onClick={() => onInvite(val)}
            disabled={shareLoading}
            style={{
              padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: shareLoading ? "var(--muted)" : "var(--terracotta)",
              color: "#fff", border: "none", cursor: shareLoading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
            }}
          >
            {shareLoading ? "…" : "Send ✉️"}
          </button>
        </div>
        {shareError && (
          <p style={{ fontSize: 13, color: "var(--red)", marginTop: 10 }}>{shareError}</p>
        )}

        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 16, lineHeight: 1.6 }}>
          The person will receive an invitation they can accept or decline from their home screen.
        </p>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function GroceryListPage() {
  const router = useRouter();
  const params = useParams();
  const listId = useMemo(() => {
    const raw = (params as any)?.listId;
    return typeof raw === "string" ? raw : null;
  }, [params]);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [listName, setListName] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const [isLeaving, setIsLeaving] = useState(false);
  const isLeavingRef = useRef(false);

  const [toast, setToast] = useState("");
  const showToast = (msg: string) => setToast(msg);

  /* Auth */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        setAuthError("");
        if (!u) { router.push("/login"); return; }
        const snap = await getDoc(doc(db, "users", u.uid));
        if (!snap.exists() || !(snap.data() as any).username) { router.push("/setup"); return; }
        setUser(u);
      } catch (e: any) {
        if (isLeavingRef.current) return;
        setAuthError(e?.message || "Auth check failed");
      } finally { setLoading(false); }
    });
    return () => unsub();
  }, [router]);

  /* Fetch list metadata */
  useEffect(() => {
    if (!listId || !user || isLeavingRef.current) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "lists", listId));
        if (!snap.exists()) { router.push("/"); return; }
        const data = snap.data() as any;
        if (Array.isArray(data.memberIds) && !data.memberIds.includes(user.uid)) {
          setAuthError("You don't have access to this list.");
          return;
        }
        setListName(data.name || "");
        setOwnerId(data.ownerId || "");
      } catch (e: any) {
        if (isLeavingRef.current) return;
        setAuthError(e?.message || "Failed to load list");
      }
    })();
  }, [listId, user, router, isLeaving]);

  /* Realtime items */
  useEffect(() => {
    if (!listId || !user) return;
    const q = query(collection(db, "lists", listId, "items"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      if (isLeavingRef.current) return;
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroceryItem, "id">) })));
    }, (err) => {
      if (isLeavingRef.current) return;
      setAuthError(err.message);
    });
  }, [listId, user, isLeaving]);

  if (loading) return <FullPageLoading />;
  if (isLeaving) return null;
  if (authError) return (
    <ErrorScreen message={authError} onBack={() => router.push("/")} />
  );
  if (!user) return <FullPageLoading label="Redirecting…" />;
  if (!listId) return <FullPageLoading label="List not found." />;

  /* Actions */
  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    await addDoc(collection(db, "lists", listId, "items"), {
      name, checked: false, createdAt: serverTimestamp(),
    });
    setNewItem("");
  };

  const toggleItem = async (item: GroceryItem) => {
    await updateDoc(doc(db, "lists", listId, "items", item.id), { checked: !item.checked });
  };

  const deleteItem = async (item: GroceryItem) => {
    await deleteDoc(doc(db, "lists", listId, "items", item.id));
    showToast(`🗑️ "${item.name}" removed`);
  };

  const leaveList = async () => {
    if (!user || !listId || ownerId === user.uid) return;
    if (!confirm("Leave this list? You will lose access.")) return;
    try {
      setIsLeaving(true); isLeavingRef.current = true;
      const snap = await getDoc(doc(db, "lists", listId));
      if (!snap.exists()) { router.replace("/"); return; }
      const data = snap.data() as any;
      const batch = writeBatch(db);
      batch.update(doc(db, "lists", listId), { memberIds: arrayRemove(user.uid) });
      if (data.ownerId && data.ownerId !== user.uid) {
        // Fetch the leaving user's username first
        const leavingUserSnap = await getDoc(doc(db, "users", user.uid));
        const leavingUsername = leavingUserSnap.exists()
          ? (leavingUserSnap.data() as any).username
          : user.email || user.uid;   // fallback

        batch.set(doc(collection(db, "users", data.ownerId, "notifications")), {
          type: "member_left_list",
          listId,
          listName: data.name || "",
          leftUserId: leavingUsername,  // ← now stores username
          createdAt: serverTimestamp(),
          read: false,
        });
      }
      await batch.commit();
      router.replace("/");
    } catch (e: any) {
      isLeavingRef.current = false; setIsLeaving(false);
      setAuthError(e?.message || "Failed to leave list");
    }
  };

  const sendInvite = async (uname: string) => {
    try {
      setShareError(""); setShareLoading(true);
      const normalized = uname.trim().toLowerCase();
      if (!normalized) return;
      const unameSnap = await getDoc(doc(db, "usernames", normalized));
      if (!unameSnap.exists()) { setShareError("No user found with that username."); return; }
      const partnerUid = (unameSnap.data() as any).uid;
      if (partnerUid === user.uid) { setShareError("You can't share with yourself 😄"); return; }
      const listSnap = await getDoc(doc(db, "lists", listId));
      if (!listSnap.exists()) { setShareError("List not found."); return; }
      const listData = listSnap.data() as any;
      if ((listData.memberIds || []).includes(partnerUid)) { setShareError("This user is already in the list."); return; }
      await setDoc(doc(db, "invitations", `${listId}_${partnerUid}`), {
        listId, listName: listData.name || listName,
        fromUserId: user.uid, fromUserEmail: user.email || "",
        toUserId: partnerUid, status: "pending", createdAt: serverTimestamp(),
      });
      setShowInviteModal(false);
      showToast(`✉️ Invitation sent to @${normalized}`);
    } catch (e: any) {
      setShareError(e?.message || "Failed to send invitation.");
    } finally { setShareLoading(false); }
  };

  const logout = async () => { await auth.signOut(); router.push("/login"); };

  /* Derived */
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const pct = items.length ? Math.round((checked.length / items.length) * 100) : 0;
  const isOwner = user.uid === ownerId;

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>

      {/* ── Topbar ── */}
      <header style={{
        background: "var(--warm-white)", borderBottom: "1.5px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 64, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--muted)", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--olive)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            ← Home
          </button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
            {listName || "My List"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isOwner && (
            <button
              onClick={leaveList}
              style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, background: "none", color: "var(--muted)", border: "1.5px solid var(--border)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
            >👋 Leave</button>
          )}
          <button
            onClick={() => setShowInviteModal(true)}
            style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--terracotta)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
          >👥 Invite</button>
          <button
            onClick={logout}
            style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, background: "none", color: "var(--muted)", border: "1.5px solid var(--border)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >Logout</button>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px" }}>

        {/* Progress */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            <span>{items.length} item{items.length !== 1 ? "s" : ""} · {checked.length} checked off</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--olive), var(--olive-light))", borderRadius: 10, transition: "width 0.4s cubic-bezier(.4,0,.2,1)" }} />
          </div>
        </div>

        {/* Add item row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add an item… (press Enter)"
            style={{
              flex: 1, padding: "13px 18px", borderRadius: 14,
              border: "1.5px solid var(--border)", background: "var(--warm-white)",
              fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "var(--ink)",
              outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = "var(--olive)"; e.target.style.boxShadow = "0 0 0 3px rgba(92,107,58,0.12)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
          />
          <button
            onClick={addItem}
            style={{ padding: "13px 22px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: "var(--olive)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--olive-light)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--olive)")}
          >+ Add</button>
        </div>

        {/* Unchecked items */}
        {unchecked.length > 0 && (
          <>
            <SectionLabel label={`To get (${unchecked.length})`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {unchecked.map((item, i) => (
                <ItemRow key={item.id} item={item} index={i} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </div>
          </>
        )}

        {/* Checked items */}
        {checked.length > 0 && (
          <>
            <SectionLabel label={`In cart (${checked.length})`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {checked.map((item, i) => (
                <ItemRow key={item.id} item={item} index={i} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </div>
          </>
        )}

        {/* Empty */}
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🛒</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "var(--ink-light)", marginBottom: 8 }}>List is empty</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>Add your first item above to get started.</div>
          </div>
        )}
      </main>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => { setShowInviteModal(false); setShareError(""); }}
          onInvite={sendInvite}
          shareLoading={shareLoading}
          shareError={shareError}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}

/* ─── Item Row ───────────────────────────────────────────────── */
function ItemRow({ item, index, onToggle, onDelete }: {
  item: GroceryItem;
  index: number;
  onToggle: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--warm-white)",
        border: "1.5px solid var(--border)",
        borderRadius: 12, padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
        opacity: item.checked ? 0.55 : 1,
        transition: "all 0.2s",
        animation: `slideIn 0.25s ease ${index * 0.04}s both`,
        boxShadow: hovered ? "0 2px 12px var(--shadow)" : "none",
      }}
    >
      {/* Checkbox */}
      <div
        onClick={() => onToggle(item)}
        style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          border: `2px solid ${item.checked ? "var(--olive)" : "var(--border)"}`,
          background: item.checked ? "var(--olive)" : "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        {item.checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>

      {/* Name */}
      <span style={{
        flex: 1, fontSize: 14, fontWeight: 500,
        textDecoration: item.checked ? "line-through" : "none",
        color: item.checked ? "var(--muted)" : "var(--ink)",
      }}>{item.name}</span>

      {/* Delete */}
      <button
        onClick={() => onDelete(item)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 14, padding: "4px 6px",
          borderRadius: 6, opacity: hovered ? 1 : 0, transition: "all 0.15s",
          fontFamily: "'DM Sans', sans-serif",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-pale)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "none"; }}
        title="Remove item"
      >✕</button>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
      {label}
    </div>
  );
}

function FullPageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cream)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>
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
        <button onClick={onBack} style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, background: "var(--olive)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back to home</button>
      </div>
    </div>
  );
}

/* ─── Modal styles ───────────────────────────────────────────── */
const mStyles: Record<string, React.CSSProperties> = {
  modalClose: { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)", borderRadius: 8, padding: "4px 8px" },
  modalLabel: { display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 },
  input: {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid var(--border)", background: "var(--cream)",
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "var(--ink)", outline: "none",
  },
};
