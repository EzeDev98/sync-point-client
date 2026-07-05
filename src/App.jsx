import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { isPWAInstalled } from "./services/deviceCompatibility";
import { checkForUpdate } from "./services/versionService";
import { getIsOnline } from "./services/networkService";

import Onboarding from "./pages/Onboarding";
import InstallPage from "./pages/InstallPage";
import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import SetPin from "./pages/SetPin";
import PinVerification from "./pages/PinVerification";
import Dashboard from "./pages/Dashboard";
import FundWallet from "./pages/FundWallet";
import ReceivePayment from "./pages/ReceivePayment";
import SendMoney from "./pages/SendMoney";
import Offline from "./pages/Offline";

const REMINDER_POLL_MS = 5 * 60 * 1000;

function InstallGuard({ children }) {
  if (!isPWAInstalled()) {
    return <Navigate to="/install" replace />;
  }
  return children;
}

// Locks the wallet the instant the app is backgrounded — tab switch, app
// minimized, screen lock — for any duration at all. Re-entering requires
// PIN verification again, matching standard banking-app behavior. The
// flag lives in sessionStorage so it's naturally cleared on a full reload
// (a fresh app open already goes through PinVerification's normal path).
function RequireUnlock({ children }) {
  const hasSession = !!localStorage.getItem("walletId");
  const isLocked = sessionStorage.getItem("walletLocked") === "true";
  if (hasSession && isLocked) {
    return <Navigate to="/verifypin" replace />;
  }
  return children;
}

function App() {
  const [updateReminder, setUpdateReminder] = useState({ show: false, remoteBuildId: null });

  useEffect(() => {
    function handleSessionExpired() {
      sessionStorage.setItem(
        "sessionExpiredMessage",
        "Your session has expired. Please sign in again."
      );
      window.location.replace("/login");
    }
    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

  // Locks the wallet on any backgrounding of the app, regardless of how
  // brief. RequireUnlock consults this flag on every protected route render.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sessionStorage.setItem("walletLocked", "true");
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Soft, non-destructive update reminder for authenticated users. Never
  // triggers performHardReset() — an authenticated user may have pending
  // offline transactions, so no update action can safely happen here.
  // This only reminds them to sync, log out, and update from /login,
  // where the actual (safe) update flow lives.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!getIsOnline()) return;
      if (!localStorage.getItem("walletId")) return; // not logged in, nothing to remind
      try {
        const { updateAvailable, remoteBuildId } = await checkForUpdate();
        if (!cancelled && updateAvailable) {
          setUpdateReminder({ show: true, remoteBuildId });
        }
      } catch (err) {
        console.warn("[App] Update reminder check failed:", err);
      }
    }

    poll();
    const intervalId = setInterval(poll, REMINDER_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/welcome" element={<InstallGuard><Welcome /></InstallGuard>} />
        <Route path="/offline" element={<InstallGuard><Offline /></InstallGuard>} />
        <Route path="/register" element={<InstallGuard><Register /></InstallGuard>} />
        <Route path="/login" element={<InstallGuard><Login /></InstallGuard>} />
        <Route path="/set-pin" element={<InstallGuard><SetPin /></InstallGuard>} />
        <Route path="/verifypin" element={<InstallGuard><PinVerification /></InstallGuard>} />
        <Route path="/dashboard" element={<InstallGuard><RequireUnlock><Dashboard /></RequireUnlock></InstallGuard>} />
        <Route path="/fund" element={<InstallGuard><RequireUnlock><FundWallet /></RequireUnlock></InstallGuard>} />
        <Route path="/receive" element={<InstallGuard><RequireUnlock><ReceivePayment /></RequireUnlock></InstallGuard>} />
        <Route path="/send" element={<InstallGuard><RequireUnlock><SendMoney /></RequireUnlock></InstallGuard>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {updateReminder.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⬆️</div>
            <h2 className="modal-title">Update available</h2>
            <p className="modal-body">
              A new version of SyncPoint is ready. To update safely, please
              sync any pending transactions, log out, and update from the
              sign-in screen. We'll remind you again shortly if you're not
              ready yet.
            </p>
            <button
              className="btn-primary"
              onClick={() => setUpdateReminder({ show: false, remoteBuildId: null })}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;