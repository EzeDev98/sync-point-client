import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, Plus, RefreshCw, LogOut } from "lucide-react";
import { syncPendingTransactions, startAutoSync, isOnline, getSyncBadgeCount } from "../services/syncService";
import { clearAllTransactions, getAllTransactions } from "../services/indexedDbService";
import { isEncryptionReady, restoreEncryption } from "../services/cryptoService";
import { logoutUser } from "../services/api";
import "../styles/auth.css";

/**
 * Resolve the display icon for a transaction.
 *
 * Fix: the original implementation checked tx.type against "send" / "receive" /
 * "fund" / "sync-tx". The actual data model (confirmed in indexedDbService,
 * SendMoney, ReceivePayment) always sets type: "TRANSFER" — direction is
 * carried by entryType: "DEBIT" | "CREDIT" instead. The old checks never
 * matched anything, so every transaction silently fell through to "•".
 */
function getIcon(entryType) {
  if (entryType === "DEBIT") return "↗";
  if (entryType === "CREDIT") return "↙";
  return "•";
}

/**
 * Resolve the display label for a transaction.
 * Same root cause as getIcon — switched from tx.type to tx.entryType.
 */
function getTxLabel(tx) {
  if (tx.entryType === "DEBIT") {
    return tx.receiverName ? `Sent to ${tx.receiverName}` : "Sent payment";
  }
  if (tx.entryType === "CREDIT") {
    return tx.senderName ? `Received from ${tx.senderName}` : "Payment received";
  }
  return "Transaction";
}

function Dashboard() {
  const navigate = useNavigate();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [offlineBalance, setOfflineBalance] = useState(() =>
    Number(sessionStorage.getItem("offlineBalance") || 0)
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  // Fix: MOCK_NOTIFICATIONS removed entirely. No notification service exists
  // yet in this codebase, so the honest production state is an empty list,
  // not fabricated data standing in for an unbuilt feature. The dropdown UI
  // is preserved and will work correctly once a real notification source
  // is wired in here.
  const [notifications, setNotifications] = useState([]);

  const [syncResult, setSyncResult] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const notifRef = useRef(null);

  const firstName = sessionStorage.getItem("firstName") || "User";
  const walletId = sessionStorage.getItem("walletId");
  const isSessionValid = !!walletId;

  const initials =
    firstName.charAt(0).toUpperCase() +
    (sessionStorage.getItem("lastName")?.charAt(0).toUpperCase() || "");

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Redirect immediately if there's no valid session — no UI flash
  useEffect(() => {
    if (!isSessionValid) {
      navigate("/login", { replace: true });
    }
  }, [isSessionValid, navigate]);

  /**
   * Ensure the DEK is available in memory before any encrypted read.
   *
   * Fix: the original component called getAllTransactions() / getSyncBadgeCount()
   * directly with no readiness check anywhere. On a fresh page load the DEK
   * only lives in cryptoService's module memory and does NOT survive a
   * reload — sessionStorage only holds the *wrapped* DEK, which must be
   * explicitly unwrapped via restoreEncryption(sessionToken) first.
   *
   * Uses the "sessionToken" key — matching what Login.jsx now writes via
   * sessionStorage.setItem("sessionToken", data.token).
   *
   * Throws "SESSION_EXPIRED" if there's no token to restore with at all —
   * callers treat that as a real expired-session case.
   */
  const ensureEncryptionReady = useCallback(async () => {
    if (isEncryptionReady()) return;

    const sessionToken = sessionStorage.getItem("sessionToken");
    if (!sessionToken) {
      throw new Error("SESSION_EXPIRED");
    }

    await restoreEncryption(sessionToken);
  }, []);

  /**
   * Load pending count + transaction list together.
   * Used by initial mount, auto-sync completion, and manual sync completion.
   */
  const refreshData = useCallback(async () => {
    await ensureEncryptionReady();
    const [count, txList] = await Promise.all([
      getSyncBadgeCount(),
      getAllTransactions(),
    ]);
    setPendingCount(count);
    setTransactions(txList);
  }, [ensureEncryptionReady]);

  // Initial load on mount
  useEffect(() => {
    if (!isSessionValid) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        await refreshData();
      } catch (err) {
        if (cancelled) return;
        console.error("[Dashboard] Failed to load data:", err);
        if (err.message === "SESSION_EXPIRED") {
          setLoadError("Your session has expired. Please log in again.");
          setTimeout(() => navigate("/login", { replace: true }), 1500);
        } else {
          setLoadError("Could not load your transactions.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionValid, refreshData, navigate]);

  // Start auto sync on mount
  useEffect(() => {
    if (!isSessionValid) return;

    const stopAutoSync = startAutoSync(async (result) => {
      setSyncResult(result);
      try {
        await refreshData();
      } catch (err) {
        // Auto-sync's data refresh failing shouldn't crash the dashboard —
        // log it and leave the previously-loaded transaction list in place.
        console.error("[Dashboard] Post-sync refresh failed:", err);
      }
    });

    return () => stopAutoSync();
  }, [isSessionValid, refreshData]);

  // Listen for balance updates from sync service
  useEffect(() => {
    const handleBalanceUpdate = (event) => {
      if (event.detail?.balance !== undefined) {
        setOfflineBalance(event.detail.balance);
      }
    };
    window.addEventListener("balance-updated", handleBalanceUpdate);
    return () => window.removeEventListener("balance-updated", handleBalanceUpdate);
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function markAsRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleSync() {
    if (!isOnline()) {
      setSyncResult({
        message: "You are offline. Please connect to the internet to sync.",
        failed: 1,
        synced: 0,
      });
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await syncPendingTransactions();
      setSyncResult(result);
      await refreshData();
    } catch (err) {
      console.error("[Dashboard] Sync failed:", err);
      setSyncResult({
        message: "Sync failed. Please try again.",
        failed: 1,
        synced: 0,
      });
      // Fix: the original code re-threw here after already setting
      // syncResult. handleSync is an onClick handler with no caller-side
      // catch, so the rethrow produced an unhandled promise rejection that
      // served no purpose — syncResult already communicates the failure
      // to the user. Removed.
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await logoutUser();
      await clearAllTransactions();
      sessionStorage.clear();
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setLogoutError(err.message || "Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!isSessionValid) return null;

  return (
    <div className="sp-app">
      {/* HEADER */}
      <header className="sp-header">
        <div className="sp-logo">
          <div className="sp-logo-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1C4.5 1 2.5 2.8 2 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 9C11.5 11.2 9.5 13 7 13C4.5 13 2.5 11.2 2 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
              <circle cx="7" cy="7" r="1.5" fill="white" stroke="white" strokeWidth="1" />
            </svg>
          </div>
          <span className="sp-logo-text">SyncPoint</span>
        </div>

        {/* NOTIFICATION BELL */}
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="sp-icon-btn"
            aria-label="Notifications"
            onClick={() => setNotifOpen((prev) => !prev)}
          >
            <Bell size={18} strokeWidth={1.8} />
            {unreadCount > 0 && <span className="notif-dot" />}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <span className="notif-header-title">
                  Notifications{" "}
                  {unreadCount > 0 && (
                    <span className="notif-count">{unreadCount}</span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button className="mark-all-btn" onClick={markAllRead}>
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications yet</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item ${!notif.read ? "unread" : ""}`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className={`notif-icon-wrap ${notif.type}`}>
                        {notif.icon}
                      </div>
                      <div className="notif-content">
                        <div className="notif-title">{notif.title}</div>
                        <div className="notif-desc">{notif.desc}</div>
                        <div className="notif-time">{notif.time}</div>
                      </div>
                      {!notif.read && <span className="unread-dot" />}
                    </div>
                  ))
                )}
              </div>

              <div className="notif-footer">
                <button className="see-all-notif">See all notifications</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="sp-body">
        {/* GREETING */}
        <div className="greeting-row">
          <div className="avatar">{initials}</div>
          <div className="greeting-text">
            <h2>Hi, {firstName.toUpperCase()}</h2>
          </div>
        </div>

        {/* BALANCE CARD */}
        <div className="balance-card">
          <div className="balance-inner">
            <div className="balance-left">
              <span className="balance-label">Available balance</span>
              <div className="balance-amount-row">
                <div className={`balance-amount ${balanceVisible ? "" : "hidden"}`}>
                  {balanceVisible
                    ? `₦ ${offlineBalance.toLocaleString()}`
                    : "*****"}
                </div>
                <button
                  className="eye-btn"
                  aria-label="Toggle balance"
                  onClick={() => setBalanceVisible((prev) => !prev)}
                >
                  {balanceVisible
                    ? <Eye size={16} strokeWidth={1.8} />
                    : <EyeOff size={16} strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            <div className="balance-divider" />

            <div className="balance-right">
              <span className="balance-sub">
                Offline wallet · Last updated just now
              </span>
              <div className={`sync-badge ${isSyncing ? "pending" : ""}`}>
                <span className={`sync-dot ${isSyncing ? "pending" : ""}`} />
                <span>
                  {isSyncing
                    ? "Syncing…"
                    : pendingCount > 0
                    ? `${pendingCount} pending sync`
                    : "All transactions synced"}
                </span>
              </div>
            </div>
          </div>

          {/* Sync result message */}
          {syncResult && !isSyncing && (
            <p style={{
              fontSize: 11.5,
              color: syncResult.failed > 0 ? "#DC2626" : "#085041",
              textAlign: "center",
              marginTop: 10,
              padding: "6px 10px",
              background: syncResult.failed > 0 ? "#FEE2E2" : "#E1F5EE",
              borderRadius: 8,
            }}>
              {syncResult.message}
            </p>
          )}
        </div>

        {/* QUICK ACTIONS */}
        <div className="actions-grid">
          <button className="action-btn" onClick={() => navigate("/send")}>
            <div className="action-icon">
              <ArrowUpRight size={18} strokeWidth={1.8} />
            </div>
            <span className="action-label">Send</span>
          </button>

          <button className="action-btn" onClick={() => navigate("/receive")}>
            <div className="action-icon">
              <ArrowDownLeft size={18} strokeWidth={1.8} />
            </div>
            <span className="action-label">Receive</span>
          </button>

          <button className="action-btn" onClick={() => navigate("/fund")}>
            <div className="action-icon">
              <Plus size={18} strokeWidth={1.8} />
            </div>
            <span className="action-label">Fund</span>
          </button>

          <button className="action-btn" onClick={handleSync} disabled={isSyncing}>
            <div className="action-icon" style={{ opacity: isSyncing ? 0.4 : 1 }}>
              <RefreshCw size={18} strokeWidth={1.8} />
            </div>
            <span className="action-label">
              {isSyncing ? "Syncing" : "Sync"}
            </span>
          </button>
        </div>

        {/* TRANSACTIONS */}
        <div className="section-header">
          <span className="section-title">Recent activity</span>
          <button className="see-all">See all</button>
        </div>

        <div className="tx-list">
          {isLoading ? (
            <div style={{
              textAlign: "center",
              padding: "32px 0",
              color: "#9CA3AF",
              fontSize: 13,
            }}>
              Loading transactions...
            </div>
          ) : loadError ? (
            <div style={{
              textAlign: "center",
              padding: "32px 0",
              color: "#DC2626",
              fontSize: 13,
            }}>
              {loadError}
            </div>
          ) : transactions.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "32px 0",
              color: "#9CA3AF",
              fontSize: 13,
            }}>
              No transactions yet
            </div>
          ) : (
            transactions.map((tx) => (
              <div className="tx-item" key={tx.transactionRef}>
                <div className={`tx-icon ${tx.entryType === "DEBIT" ? "send" : "receive"}`}>
                  {getIcon(tx.entryType)}
                </div>
                <div className="tx-info">
                  <div className="tx-name">{getTxLabel(tx)}</div>
                  <div className="tx-time">
                    {new Date(tx.createdAt).toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="tx-right">
                  <div className={`tx-amount ${tx.entryType === "CREDIT" ? "credit" : "debit"}`}>
                    {tx.entryType === "CREDIT"
                      ? `+₦${Number(tx.amount).toLocaleString()}`
                      : `-₦${Number(tx.amount).toLocaleString()}`}
                  </div>
                  <div className={`tx-status ${tx.synced ? "" : "offline"}`}>
                    {tx.status === "CORRUPTED"
                      ? "Unreadable"
                      : tx.synced
                      ? "Synced"
                      : "Pending sync"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sp-divider" />
      <div className="logout-section">
        {logoutError && (
          <p className="field-error" style={{ textAlign: "center", marginBottom: 8 }}>
            {logoutError}
          </p>
        )}
        <button
          className="logout-btn"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={14} strokeWidth={1.8} />
          {isLoggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
    </div>
  );
}

export default Dashboard;










// import { useState, useRef, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { Bell, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, Plus, RefreshCw, LogOut } from "lucide-react";
// import { syncPendingTransactions, startAutoSync, isOnline, getSyncBadgeCount } from "../services/syncService";
// import { clearAllTransactions, getAllTransactions } from "../services/indexedDbService";
// import { logoutUser } from "../services/api";
// import "../styles/auth.css";

// const MOCK_NOTIFICATIONS = [
//   { id: 1, type: "success", icon: "✅", title: "Offline wallet funded", desc: "₦20,000 was added to your offline wallet successfully.", time: "2 mins ago", read: false },
//   { id: 2, type: "success", icon: "🏦", title: "Transfer to online successful", desc: "₦5,000 moved from offline wallet to your online account.", time: "1 hour ago", read: false },
//   { id: 3, type: "error", icon: "⚠️", title: "Sync failed", desc: "3 offline transactions could not be synced. Tap Sync to retry.", time: "3 hours ago", read: false },
//   { id: 4, type: "info", icon: "🔐", title: "PIN change required", desc: "Your transaction PIN was reset. Please set a new PIN to continue.", time: "Yesterday", read: true },
//   { id: 5, type: "warning", icon: "🔄", title: "Offline sync completed", desc: "5 pending transactions synced successfully.", time: "2 days ago", read: true },
// ];

// function getIcon(type) {
//   if (type === "send") return "↗";
//   if (type === "receive") return "↙";
//   if (type === "fund") return "₦";
//   if (type === "sync-tx") return "↻";
//   return "•";
// }

// function Dashboard() {
//   const navigate = useNavigate();
//   const [balanceVisible, setBalanceVisible] = useState(false);
//   const [offlineBalance, setOfflineBalance] = useState(() =>
//     Number(sessionStorage.getItem("offlineBalance") || 0)
//   );
//   const [isSyncing, setIsSyncing] = useState(false);
//   const [isLoggingOut, setIsLoggingOut] = useState(false);
//   const [logoutError, setLogoutError] = useState("");
//   const [notifOpen, setNotifOpen] = useState(false);
//   const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
//   const [syncResult, setSyncResult] = useState(null);
//   const [pendingCount, setPendingCount] = useState(0);
//   const [transactions, setTransactions] = useState([]);
//   const notifRef = useRef(null);

//   const firstName = sessionStorage.getItem("firstName") || "User";
//   const initials =
//     firstName.charAt(0).toUpperCase() +
//     (sessionStorage.getItem("lastName")?.charAt(0).toUpperCase() || "");

//   const unreadCount = notifications.filter((n) => !n.read).length;

//   // Load pending count on mount
//   useEffect(() => {
//     async function loadData() {
//       const count = await getSyncBadgeCount();
//       setPendingCount(count);

//       const txList = await getAllTransactions();
//       setTransactions(txList);
//     }
//     loadData();
//   }, []);

//   // Start auto sync on mount
//   useEffect(() => {
//     const stopAutoSync = startAutoSync(async (result) => {
//       setSyncResult(result);
//       const count = await getSyncBadgeCount();
//       setPendingCount(count);
//       const txList = await getAllTransactions();
//       setTransactions(txList);
//     });
//     return () => stopAutoSync();
//   }, []);

//   // Listen for balance updates from sync service
//   useEffect(() => {
//     const handleBalanceUpdate = (event) => {
//       if (event.detail?.balance !== undefined) {
//         setOfflineBalance(event.detail.balance);
//       }
//     };
//     window.addEventListener("balance-updated", handleBalanceUpdate);
//     return () => window.removeEventListener("balance-updated", handleBalanceUpdate);
//   }, []);

//   // Close notification dropdown on outside click
//   useEffect(() => {
//     function handleClickOutside(e) {
//       if (notifRef.current && !notifRef.current.contains(e.target)) {
//         setNotifOpen(false);
//       }
//     }
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   function markAsRead(id) {
//     setNotifications((prev) =>
//       prev.map((n) => (n.id === id ? { ...n, read: true } : n))
//     );
//   }

//   function markAllRead() {
//     setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
//   }

//   async function handleSync() {
//     if (!isOnline()) {
//       setSyncResult({
//         message: "You are offline. Please connect to the internet to sync.",
//         failed: 1,
//         synced: 0,
//       });
//       return;
//     }

//     setIsSyncing(true);
//     setSyncResult(null);

//     try {
//       const result = await syncPendingTransactions();
//       setSyncResult(result);
//       const count = await getSyncBadgeCount();
//       setPendingCount(count);
//       const txList = await getAllTransactions();
//       setTransactions(txList);
//     } catch (err) {
//       setSyncResult({
//         message: "Sync failed. Please try again.",
//         failed: 1,
//         synced: 0,
//       });
//       throw err;
//     } finally {
//       setIsSyncing(false);
//     }
//   }

//   async function handleLogout() {
//     setIsLoggingOut(true);
//     setLogoutError("");
//     try {
//       await logoutUser();
//       await clearAllTransactions();
//       sessionStorage.clear();
//       navigate("/login");
//     } catch (err) {
//       console.error("Logout error:", err);
//       setLogoutError(err.message || "Logout failed. Please try again.");
//     } finally {
//       setIsLoggingOut(false);
//     }
//   }

//   return (
//     <div className="sp-app">
//       {/* HEADER */}
//       <header className="sp-header">
//         <div className="sp-logo">
//           <div className="sp-logo-icon">
//             <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//               <path d="M7 1C4.5 1 2.5 2.8 2 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
//               <path d="M12 9C11.5 11.2 9.5 13 7 13C4.5 13 2.5 11.2 2 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
//               <circle cx="7" cy="7" r="1.5" fill="white" stroke="white" strokeWidth="1" />
//             </svg>
//           </div>
//           <span className="sp-logo-text">SyncPoint</span>
//         </div>

//         {/* NOTIFICATION BELL */}
//         <div className="notif-wrapper" ref={notifRef}>
//           <button
//             className="sp-icon-btn"
//             aria-label="Notifications"
//             onClick={() => setNotifOpen((prev) => !prev)}
//           >
//             <Bell size={18} strokeWidth={1.8} />
//             {unreadCount > 0 && <span className="notif-dot" />}
//           </button>

//           {notifOpen && (
//             <div className="notif-dropdown">
//               <div className="notif-header">
//                 <span className="notif-header-title">
//                   Notifications{" "}
//                   {unreadCount > 0 && (
//                     <span className="notif-count">{unreadCount}</span>
//                   )}
//                 </span>
//                 {unreadCount > 0 && (
//                   <button className="mark-all-btn" onClick={markAllRead}>
//                     Mark all as read
//                   </button>
//                 )}
//               </div>

//               <div className="notif-list">
//                 {notifications.length === 0 ? (
//                   <div className="notif-empty">No notifications yet</div>
//                 ) : (
//                   notifications.map((notif) => (
//                     <div
//                       key={notif.id}
//                       className={`notif-item ${!notif.read ? "unread" : ""}`}
//                       onClick={() => markAsRead(notif.id)}
//                     >
//                       <div className={`notif-icon-wrap ${notif.type}`}>
//                         {notif.icon}
//                       </div>
//                       <div className="notif-content">
//                         <div className="notif-title">{notif.title}</div>
//                         <div className="notif-desc">{notif.desc}</div>
//                         <div className="notif-time">{notif.time}</div>
//                       </div>
//                       {!notif.read && <span className="unread-dot" />}
//                     </div>
//                   ))
//                 )}
//               </div>

//               <div className="notif-footer">
//                 <button className="see-all-notif">See all notifications</button>
//               </div>
//             </div>
//           )}
//         </div>
//       </header>

//       <div className="sp-body">
//         {/* GREETING */}
//         <div className="greeting-row">
//           <div className="avatar">{initials}</div>
//           <div className="greeting-text">
//             <h2>Hi, {firstName.toUpperCase()} 👋</h2>
//             <p>Welcome back to SyncPoint</p>
//           </div>
//         </div>

//         {/* BALANCE CARD */}
//         <div className="balance-card">
//           <div className="balance-inner">
//             <div className="balance-left">
//               <span className="balance-label">Available balance</span>
//               <div className="balance-amount-row">
//                 <div className={`balance-amount ${balanceVisible ? "" : "hidden"}`}>
//                   {balanceVisible
//                     ? `₦ ${offlineBalance.toLocaleString()}`
//                     : "• • • • •"}
//                 </div>
//                 <button
//                   className="eye-btn"
//                   aria-label="Toggle balance"
//                   onClick={() => setBalanceVisible((prev) => !prev)}
//                 >
//                   {balanceVisible
//                     ? <Eye size={16} strokeWidth={1.8} />
//                     : <EyeOff size={16} strokeWidth={1.8} />}
//                 </button>
//               </div>
//             </div>

//             <div className="balance-divider" />

//             <div className="balance-right">
//               <span className="balance-sub">
//                 Offline wallet · Last updated just now
//               </span>
//               <div className={`sync-badge ${isSyncing ? "pending" : ""}`}>
//                 <span className={`sync-dot ${isSyncing ? "pending" : ""}`} />
//                 <span>
//                   {isSyncing
//                     ? "Syncing…"
//                     : pendingCount > 0
//                     ? `${pendingCount} pending sync`
//                     : "All transactions synced"}
//                 </span>
//               </div>
//             </div>
//           </div>

//           {/* Sync result message */}
//           {syncResult && !isSyncing && (
//             <p style={{
//               fontSize: 11.5,
//               color: syncResult.failed > 0 ? "#DC2626" : "#085041",
//               textAlign: "center",
//               marginTop: 10,
//               padding: "6px 10px",
//               background: syncResult.failed > 0 ? "#FEE2E2" : "#E1F5EE",
//               borderRadius: 8,
//             }}>
//               {syncResult.message}
//             </p>
//           )}
//         </div>

//         {/* QUICK ACTIONS */}
//         <div className="actions-grid">
//           <button className="action-btn" onClick={() => navigate("/send")}>
//             <div className="action-icon">
//               <ArrowUpRight size={18} strokeWidth={1.8} />
//             </div>
//             <span className="action-label">Send</span>
//           </button>

//           <button className="action-btn" onClick={() => navigate("/receive")}>
//             <div className="action-icon">
//               <ArrowDownLeft size={18} strokeWidth={1.8} />
//             </div>
//             <span className="action-label">Receive</span>
//           </button>

//           <button className="action-btn" onClick={() => navigate("/fund")}>
//             <div className="action-icon">
//               <Plus size={18} strokeWidth={1.8} />
//             </div>
//             <span className="action-label">Fund</span>
//           </button>

//           <button className="action-btn" onClick={handleSync} disabled={isSyncing}>
//             <div className="action-icon" style={{ opacity: isSyncing ? 0.4 : 1 }}>
//               <RefreshCw size={18} strokeWidth={1.8} />
//             </div>
//             <span className="action-label">
//               {isSyncing ? "Syncing" : "Sync"}
//             </span>
//           </button>
//         </div>

//         {/* TRANSACTIONS */}
//         <div className="section-header">
//           <span className="section-title">Recent activity</span>
//           <button className="see-all">See all</button>
//         </div>

//         <div className="tx-list">
//           {transactions.length === 0 ? (
//             <div style={{
//               textAlign: "center",
//               padding: "32px 0",
//               color: "#9CA3AF",
//               fontSize: 13,
//             }}>
//               No transactions yet
//             </div>
//           ) : (
//             transactions.map((tx) => (
//               <div className="tx-item" key={tx.transactionRef}>
//                 <div className={`tx-icon ${tx.type}`}>
//                   {getIcon(tx.type)}
//                 </div>
//                 <div className="tx-info">
//                   <div className="tx-name">
//                     {tx.type === "send"
//                       ? `Sent to ${tx.receiverName}`
//                       : tx.type === "receive"
//                       ? "Payment received"
//                       : tx.type === "fund"
//                       ? "Wallet funded"
//                       : "Sync completed"}
//                   </div>
//                   <div className="tx-time">
//                     {new Date(tx.createdAt).toLocaleString("en-NG", {
//                       day: "numeric",
//                       month: "short",
//                       hour: "2-digit",
//                       minute: "2-digit",
//                     })}
//                   </div>
//                 </div>
//                 <div className="tx-right">
//                   <div className={`tx-amount ${tx.type === "receive" || tx.type === "fund" ? "credit" : "debit"}`}>
//                     {tx.type === "receive" || tx.type === "fund"
//                       ? `+₦${tx.amount.toLocaleString()}`
//                       : `-₦${tx.amount.toLocaleString()}`}
//                   </div>
//                   <div className={`tx-status ${tx.synced ? "" : "offline"}`}>
//                     {tx.synced ? "Synced" : "Pending sync"}
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       </div>

//       <div className="sp-divider" />
//       <div className="logout-section">
//         {logoutError && (
//           <p className="field-error" style={{ textAlign: "center", marginBottom: 8 }}>
//             {logoutError}
//           </p>
//         )}
//         <button
//           className="logout-btn"
//           onClick={handleLogout}
//           disabled={isLoggingOut}
//         >
//           <LogOut size={14} strokeWidth={1.8} />
//           {isLoggingOut ? "Logging out..." : "Log out"}
//         </button>
//       </div>
//     </div>
//   );
// }

// export default Dashboard;