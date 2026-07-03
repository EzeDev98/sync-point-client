import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, Plus, RefreshCw, LogOut } from "lucide-react";
import { syncPendingTransactions, startAutoSync, getSyncBadgeCount } from "../services/syncService";
import { getAllTransactions } from "../services/indexedDbService";
import { requestLogout } from "../services/logoutManager";
import { isEncryptionReady } from "../services/cryptoService";
import { calculateOfflineBalance } from "../services/walletLedger";
import { useNetwork } from "../hooks/useNetwork";
import NoInternetModal from "../components/NoInternetModal";
import AppLogo from "../components/AppLogo";
import "../styles/dashboard.css";

function getIcon(entryType) {
  if (entryType === "DEBIT") return "↗";
  if (entryType === "CREDIT") return "↙";
  return "•";
}

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
  const [offlineBalance, setOfflineBalance] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [logoutStep, setLogoutStep] = useState("idle");
  const [logoutBlockModal, setLogoutBlockModal] = useState({ show: false, balance: 0 });

  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("notifications") || "[]");
    } catch {
      return [];
    }
  });

  const [syncResult, setSyncResult] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const notifRef = useRef(null);

  const { isOffline } = useNetwork();
  const [noInternetModal, setNoInternetModal] = useState(false);

  const firstName =
    sessionStorage.getItem("firstName") ??
    localStorage.getItem("firstName") ??
    "User";

  const lastName =
    sessionStorage.getItem("lastName") ??
    localStorage.getItem("lastName") ??
    "";

  const walletId =
    sessionStorage.getItem("walletId") ??
    localStorage.getItem("walletId");

  const isSessionValid = !!walletId;

  const initials =
    firstName.charAt(0).toUpperCase() +
    (lastName.charAt(0).toUpperCase() || "");

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!isSessionValid) {
      navigate("/login", { replace: true });
    }
  }, [isSessionValid, navigate]);

  const ensureEncryptionReady = useCallback(async () => {
    if (isEncryptionReady()) return;
    // Encryption must have been restored during PIN verification.
    // If we arrive here without it the wallet is locked — send to PIN screen.
    throw new Error("SESSION_EXPIRED");
  }, []);

  /**
   * Load pending count, transaction list, and ledger balance together.
   * Balance is always derived from IndexedDB — never from sessionStorage
   * or localStorage — so it is always correct after app closure or reload.
   */
  const refreshData = useCallback(async () => {
    await ensureEncryptionReady();
    const [count, txList, balance] = await Promise.all([
      getSyncBadgeCount(),
      getAllTransactions(),
      calculateOfflineBalance(),
    ]);
    setPendingCount(count);
    setTransactions(txList);
    setOfflineBalance(balance);
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
          setLoadError("Please re-enter your PIN to unlock your wallet.");
          setTimeout(() => navigate("/verifypin", { replace: true }), 800);
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
        console.error("[Dashboard] Post-sync refresh failed:", err);
      }
    });

    return () => stopAutoSync();
  }, [isSessionValid, refreshData]);

  // Listen for balance-updated events from other pages.
  // When received, recalculate from the ledger to stay authoritative.
  useEffect(() => {
    async function handleBalanceUpdate() {
      try {
        const balance = await calculateOfflineBalance();
        setOfflineBalance(balance);
      } catch (err) {
        console.error("[Dashboard] Balance recalculation failed:", err);
      }
    }
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
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      localStorage.setItem("notifications", JSON.stringify(updated));
      return updated;
    });
  }

  function markAllRead() {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem("notifications", JSON.stringify(updated));
      return updated;
    });
  }

  async function handleSync() {

    if (isOffline) {
      setNoInternetModal(true);
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    // Yield to the browser so the spinner paints before work begins
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    const MIN_SPIN_MS = 600;
    const started = Date.now();

    try {
      const result = await syncPendingTransactions();

      const elapsed = Date.now() - started;
      if (elapsed < MIN_SPIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS - elapsed));
      }

      setSyncResult(result);
      await refreshData();
    } catch (err) {
      console.error("[Dashboard] Sync failed:", err);
      const elapsed = Date.now() - started;
      if (elapsed < MIN_SPIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS - elapsed));
      }
      setSyncResult({
        message: "Sync failed. Please try again.",
        failed: 1,
        synced: 0,
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleLogout() {

    if (isOffline) {
      setNoInternetModal(true);
      return;
    }

    setIsLoggingOut(true);
    setLogoutError("");
    setLogoutStep("checking");

    await requestLogout({
      navigate,

      onBlocked: ({ balance }) => {
        sessionStorage.setItem(
          "logoutBlockedMessage",
          `You still have ₦${balance.toLocaleString()} in your offline wallet. ` +
            `Transfer the remaining balance to your online account before logging out.`
        );
        setIsLoggingOut(false);
        setLogoutStep("idle");
        setLogoutBlockModal({ show: true, balance });
      },

      onSyncing: () => {
        setLogoutStep("syncing");
      },

      onSyncDone: (result) => {
        setSyncResult(result);
      },

      onError: (message) => {
        setLogoutError(message);
        setLogoutStep("error");
        setIsLoggingOut(false);
      },

      onSuccess: () => {
        setLogoutStep("idle");
      },
    });

    setIsLoggingOut(false);
  }

  if (!isSessionValid) return null;

  return (
    <div className="sp-app">
      {/* HEADER */}
      <header className="sp-header">
        <div className="sp-logo">
          <div className="sp-logo">
            <AppLogo size={28} />
            <span className="sp-logo-text">SyncPoint</span>
          </div>
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
                        <div className="notif-time">
                          {new Date(notif.time).toLocaleString("en-NG", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
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
                    ? `₦${offlineBalance.toLocaleString()}`
                    : "*****"}
                </div>
                <button
                  className="eye-btn"
                  aria-label="Toggle balance"
                  onClick={() => setBalanceVisible((prev) => !prev)}
                >
                  {balanceVisible ? (
                    <Eye size={16} strokeWidth={1.8} />
                  ) : (
                    <EyeOff size={16} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            <div className="balance-divider" />

            <div className="balance-right">
              <span className="balance-sub">Wallet · Last updated just now</span>
                <div
                    className={`sync-badge ${
                        syncResult?.failed > 0
                            ? "error"
                            : isSyncing
                            ? "pending"
                            : ""
                    }`}
                >
                    <span
                        className={`sync-dot ${
                            syncResult?.failed > 0
                                ? "error"
                                : isSyncing
                                ? "pending"
                                : ""
                        }`}
                    />

                    <span>
                        {syncResult?.failed > 0
                            ? "Sync failed"
                            : isSyncing
                            ? "Syncing transactions..."
                            : pendingCount > 0
                            ? `${pendingCount} transaction${pendingCount > 1 ? "s" : ""} waiting`
                            : "All transactions synced"}
                    </span>
                </div>
            </div>
          </div>
        </div>

        {/* Sync result message */}
        <div className="sync-result-container">
          {syncResult && !isSyncing && (
            <p
              className={`sync-result-message ${
                syncResult.failed > 0 ? "error" : "success"
              }`}
            >
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

          <button
            className="action-btn"
            onClick={() => {
              if (isOffline) {
                setNoInternetModal(true);
                return;
              }

              navigate("/fund");
            }}
          >
            <div className={`action-icon ${isOffline ? "offline-action" : ""}`}>
              <Plus size={18} strokeWidth={1.8} />
            </div>
            <span className="action-label">Fund</span>
          </button>

          <button
            className="action-btn"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <div className={`action-icon ${isOffline ? "offline-action" : ""}`}>
              <span className={isSyncing ? "spin-wrap" : ""}>
                <RefreshCw size={18} strokeWidth={1.8} />
              </span>
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
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              Loading transactions...
            </div>
          ) : loadError ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                color: "#DC2626",
                fontSize: 13,
              }}
            >
              {loadError}
            </div>
          ) : transactions.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              No transactions yet
            </div>
          ) : (
            transactions.map((tx) => (
              <div className="tx-item" key={tx.transactionRef}>
                <div
                  className={`tx-icon ${
                    tx.entryType === "DEBIT" ? "send" : "receive"
                  }`}
                >
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
                  <div
                    className={`tx-amount ${
                      tx.entryType === "CREDIT" ? "credit" : "debit"
                    }`}
                  >
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
          <p
            className="field-error"
            style={{ textAlign: "center", marginBottom: 8 }}
          >
            {logoutError}
          </p>
        )}
        <button
          className="logout-btn"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={14} strokeWidth={1.8} />
          {logoutStep === "checking" && "Checking wallet..."}
          {logoutStep === "syncing" && "Syncing transactions..."}
          {logoutStep === "error" && "Retry logout"}
          {logoutStep === "idle" &&
            (isLoggingOut ? "Logging out..." : "Log out")}
        </button>
      </div>

      {/* LOGOUT BLOCKED MODAL */}
      {logoutBlockModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Cannot Log Out Yet</h2>
            <p className="modal-body">
              You still have{" "}
              <strong>₦{logoutBlockModal.balance.toLocaleString()}</strong> in
              your offline wallet. You must transfer your remaining balance to
              your online account before logging out.
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                setLogoutBlockModal({ show: false, balance: 0 });
                navigate("/fund", {
                  state: { autoTab: "online", fromLogout: true },
                });
              }}
            >
              Transfer Balance Now
            </button>
            <button
              className="logout-btn"
              style={{ marginTop: 8 }}
              onClick={() => setLogoutBlockModal({ show: false, balance: 0 })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <NoInternetModal
        show={noInternetModal}
        onClose={() => setNoInternetModal(false)}
      />
    </div>
  );
}

export default Dashboard;