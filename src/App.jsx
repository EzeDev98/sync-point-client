import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { isPWAInstalled } from "./services/deviceCompatibility";
import { checkForUpdate } from "./services/versionService";
import { getIsOnline } from "./services/networkService";

import Onboarding from "./pages/Onboarding";
import InstallPage from "./pages/InstallPage";
import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyResetOtp from "./pages/VerifyResetOtp";
import CreateNewPassword from "./pages/CreateNewPassword";
import SetPin from "./pages/SetPin";
import ChangePin from "./pages/ChangePin";
import PinVerification from "./pages/PinVerification";
import Dashboard from "./pages/Dashboard";
import FundWallet from "./pages/FundWallet";
import ReceivePayment from "./pages/ReceivePayment";
import SendMoney from "./pages/SendMoney";
import Offline from "./pages/Offline";
import { getPendingCount } from "./services/indexedDbService";
import { syncPendingTransactionsGuarded } from "./services/syncService";
import "./styles/transitions.css";

const PERIODIC_SYNC_MS = 10 * 60 * 1000;
const MAX_OFFLINE_PENDING = 10;
const REMINDER_POLL_MS = 5 * 60 * 1000;
const PROTECTED_PATHS = ["/dashboard", "/fund", "/receive", "/send"];

function InstallGuard({ children }) {
  if (!isPWAInstalled()) {
    return <Navigate to="/install" replace />;
  }
  return children;
}

function AppLockGate() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleVisibilityChange() {
      const hasSession = !!localStorage.getItem("walletId");
      if (!hasSession) return;

      if (document.visibilityState === "hidden") {
        sessionStorage.setItem("walletLocked", "true");
        return;
      }

      const isLocked = sessionStorage.getItem("walletLocked") === "true";
      const onProtectedRoute = PROTECTED_PATHS.some((p) => location.pathname.startsWith(p));

      if (isLocked && onProtectedRoute) {
        navigate("/verifypin", { replace: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [navigate, location.pathname]);

  return null;
}

function RequireUnlock({ children }) {
  const hasSession = !!localStorage.getItem("walletId");
  const isLocked = sessionStorage.getItem("walletLocked") === "true";
  if (hasSession && isLocked) {
    return <Navigate to="/verifypin" replace />;
  }
  return children;
}

const ROUTE_EXIT_MS = 160;

function AnimatedRoutes({ routeChildren }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState("route-enter");

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setStage("route-exit");
      const timeout = setTimeout(() => {
        setDisplayLocation(location);
        setStage("route-enter");
      }, ROUTE_EXIT_MS);
      return () => clearTimeout(timeout);
    }
  }, [location, displayLocation]);

  return (
    <div className={`route-transition-wrapper ${stage}`}>
      <Routes location={displayLocation}>{routeChildren}</Routes>
    </div>
  );
}

function PeriodicSyncGate({ onOfflineReminder }) {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const hasSession = !!localStorage.getItem("walletId");
      if (!hasSession) return;

      const pendingCount = await getPendingCount();
      if (pendingCount === 0) return;

      if (getIsOnline()) {
        try {
          await syncPendingTransactionsGuarded();
        } catch (err) {
          console.warn("[App] Periodic sync failed:", err.message);
        }
      } else if (!cancelled) {
        onOfflineReminder(pendingCount);
      }
    }

    const intervalId = setInterval(tick, PERIODIC_SYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [onOfflineReminder]);

  return null;
}

function App() {
  const [updateReminder, setUpdateReminder] = useState({ show: false, remoteBuildId: null });
  const [syncReminder, setSyncReminder] = useState({ show: false, pendingCount: 0 });
  const handleOfflineReminder = useCallback((pendingCount) => {
    setSyncReminder({ show: true, pendingCount });
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!getIsOnline()) return;
      if (!localStorage.getItem("walletId")) return;
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
      <AppLockGate />
      <PeriodicSyncGate onOfflineReminder={handleOfflineReminder} />
      <AnimatedRoutes
        routeChildren={
          <>
            <Route path="/" element={<Onboarding />} />
            <Route path="/install" element={<InstallPage />} />
            <Route path="/welcome" element={<InstallGuard><Welcome /></InstallGuard>} />
            <Route path="/offline" element={<InstallGuard><Offline /></InstallGuard>} />
            <Route path="/register" element={<InstallGuard><Register /></InstallGuard>} />
            <Route path="/login" element={<InstallGuard><Login /></InstallGuard>} />
            <Route path="/forgot-password" element={<InstallGuard><ForgotPassword /></InstallGuard>} />
            <Route path="/forgot-password/verify" element={<InstallGuard><VerifyResetOtp /></InstallGuard>} />
            <Route path="/forgot-password/reset" element={<InstallGuard><CreateNewPassword /></InstallGuard>} />
            <Route path="/set-pin" element={<InstallGuard><SetPin /></InstallGuard>} />
            <Route path="/change-pin" element={<InstallGuard><RequireUnlock><ChangePin /></RequireUnlock></InstallGuard>} />
            <Route path="/verifypin" element={<InstallGuard><PinVerification /></InstallGuard>} />
            <Route path="/dashboard" element={<InstallGuard><RequireUnlock><Dashboard /></RequireUnlock></InstallGuard>} />
            <Route path="/fund" element={<InstallGuard><RequireUnlock><FundWallet /></RequireUnlock></InstallGuard>} />
            <Route path="/receive" element={<InstallGuard><RequireUnlock><ReceivePayment /></RequireUnlock></InstallGuard>} />
            <Route path="/send" element={<InstallGuard><RequireUnlock><SendMoney /></RequireUnlock></InstallGuard>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        }
      />

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

      {syncReminder.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">📡</div>
            <h2 className="modal-title">You have pending transactions</h2>
            <p className="modal-body">
              You have {syncReminder.pendingCount} transaction(s) waiting to sync.
              Please connect to the internet soon so they don't get stuck.
              {syncReminder.pendingCount >= MAX_OFFLINE_PENDING &&
                " You've reached the maximum offline limit — you must go online to sync before creating any new transactions."}
            </p>
            <button
              className="btn-primary"
              onClick={() => setSyncReminder({ show: false, pendingCount: 0 })}
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







// import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
// import { useEffect, useState, useCallback } from "react";
// import { isPWAInstalled } from "./services/deviceCompatibility";
// import { checkForUpdate } from "./services/versionService";
// import { getIsOnline } from "./services/networkService";

// import Onboarding from "./pages/Onboarding";
// import InstallPage from "./pages/InstallPage";
// import Welcome from "./pages/Welcome";
// import Register from "./pages/Register";
// import Login from "./pages/Login";
// import SetPin from "./pages/SetPin";
// import PinVerification from "./pages/PinVerification";
// import Dashboard from "./pages/Dashboard";
// import FundWallet from "./pages/FundWallet";
// import ReceivePayment from "./pages/ReceivePayment";
// import SendMoney from "./pages/SendMoney";
// import Offline from "./pages/Offline";
// import { getPendingCount } from "./services/indexedDbService";
// import { syncPendingTransactionsGuarded } from "./services/syncService";

// const PERIODIC_SYNC_MS = 10 * 60 * 1000;
// const MAX_OFFLINE_PENDING = 10;
// const REMINDER_POLL_MS = 5 * 60 * 1000;
// const PROTECTED_PATHS = ["/dashboard", "/fund", "/receive", "/send"];

// function InstallGuard({ children }) {
//   if (!isPWAInstalled()) {
//     return <Navigate to="/install" replace />;
//   }
//   return children;
// }

// // Actively enforces the lock the instant the app is backgrounded for any
// // duration, and the instant it becomes visible again — rather than
// // passively waiting for some unrelated re-render to notice. Mounted once,
// // inside the Router, so it can navigate imperatively regardless of which
// // route currently happens to be showing.
// function AppLockGate() {
//   const navigate = useNavigate();
//   const location = useLocation();

//   useEffect(() => {
//     function handleVisibilityChange() {
//       const hasSession = !!localStorage.getItem("walletId");
//       if (!hasSession) return;

//       if (document.visibilityState === "hidden") {
//         sessionStorage.setItem("walletLocked", "true");
//         return;
//       }

//       // visibilityState === "visible"
//       const isLocked = sessionStorage.getItem("walletLocked") === "true";
//       const onProtectedRoute = PROTECTED_PATHS.some((p) => location.pathname.startsWith(p));

//       if (isLocked && onProtectedRoute) {
//         navigate("/verifypin", { replace: true });
//       }
//     }

//     document.addEventListener("visibilitychange", handleVisibilityChange);
//     return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
//   }, [navigate, location.pathname]);

//   return null;
// }

// // Still needed as a render-time guard for the case where the user
// // navigates via a link/back-button while locked, even without a
// // visibility change occurring.
// function RequireUnlock({ children }) {
//   const hasSession = !!localStorage.getItem("walletId");
//   const isLocked = sessionStorage.getItem("walletLocked") === "true";
//   if (hasSession && isLocked) {
//     return <Navigate to="/verifypin" replace />;
//   }
//   return children;
// }

// // Fires every 10 minutes while a session exists. Online: triggers a sync
// // if anything is pending. Offline: shows a non-blocking reminder if
// // anything is pending, and separately flags the hard cap so transaction
// // creation can be blocked once the limit is hit (enforced at the
// // creation call site, not here).
// function PeriodicSyncGate({ onOfflineReminder }) {
//   useEffect(() => {
//     let cancelled = false;

//     async function tick() {
//       const hasSession = !!localStorage.getItem("walletId");
//       if (!hasSession) return;

//       const pendingCount = await getPendingCount();
//       if (pendingCount === 0) return;

//       if (getIsOnline()) {
//         try {
//           await syncPendingTransactionsGuarded();
//         } catch (err) {
//           console.warn("[App] Periodic sync failed:", err.message);
//         }
//       } else if (!cancelled) {
//         onOfflineReminder(pendingCount);
//       }
//     }

//     const intervalId = setInterval(tick, PERIODIC_SYNC_MS);
//     return () => {
//       cancelled = true;
//       clearInterval(intervalId);
//     };
//   }, [onOfflineReminder]);

//   return null;
// }

// function App() {
//   const [updateReminder, setUpdateReminder] = useState({ show: false, remoteBuildId: null });
//   const [syncReminder, setSyncReminder] = useState({ show: false, pendingCount: 0 });
//   const handleOfflineReminder = useCallback((pendingCount) => {
//     setSyncReminder({ show: true, pendingCount });
//   }, []);

//   useEffect(() => {
//     function handleSessionExpired() {
//       sessionStorage.setItem(
//         "sessionExpiredMessage",
//         "Your session has expired. Please sign in again."
//       );
//       window.location.replace("/login");
//     }
//     window.addEventListener("session-expired", handleSessionExpired);
//     return () => window.removeEventListener("session-expired", handleSessionExpired);
//   }, []);

//   useEffect(() => {
//     let cancelled = false;

//     async function poll() {
//       if (!getIsOnline()) return;
//       if (!localStorage.getItem("walletId")) return;
//       try {
//         const { updateAvailable, remoteBuildId } = await checkForUpdate();
//         if (!cancelled && updateAvailable) {
//           setUpdateReminder({ show: true, remoteBuildId });
//         }
//       } catch (err) {
//         console.warn("[App] Update reminder check failed:", err);
//       }
//     }

//     poll();
//     const intervalId = setInterval(poll, REMINDER_POLL_MS);

//     return () => {
//       cancelled = true;
//       clearInterval(intervalId);
//     };
//   }, []);

//   return (
//     <BrowserRouter>
//       <AppLockGate />
//       <PeriodicSyncGate onOfflineReminder={handleOfflineReminder} />
//       <Routes>
//         <Route path="/" element={<Onboarding />} />
//         <Route path="/install" element={<InstallPage />} />
//         <Route path="/welcome" element={<InstallGuard><Welcome /></InstallGuard>} />
//         <Route path="/offline" element={<InstallGuard><Offline /></InstallGuard>} />
//         <Route path="/register" element={<InstallGuard><Register /></InstallGuard>} />
//         <Route path="/login" element={<InstallGuard><Login /></InstallGuard>} />
//         <Route path="/set-pin" element={<InstallGuard><SetPin /></InstallGuard>} />
//         <Route path="/verifypin" element={<InstallGuard><PinVerification /></InstallGuard>} />
//         <Route path="/dashboard" element={<InstallGuard><RequireUnlock><Dashboard /></RequireUnlock></InstallGuard>} />
//         <Route path="/fund" element={<InstallGuard><RequireUnlock><FundWallet /></RequireUnlock></InstallGuard>} />
//         <Route path="/receive" element={<InstallGuard><RequireUnlock><ReceivePayment /></RequireUnlock></InstallGuard>} />
//         <Route path="/send" element={<InstallGuard><RequireUnlock><SendMoney /></RequireUnlock></InstallGuard>} />

//         {/* Catch-all */}
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>

//       {updateReminder.show && (
//         <div className="modal-overlay">
//           <div className="modal-card">
//             <div className="modal-icon">⬆️</div>
//             <h2 className="modal-title">Update available</h2>
//             <p className="modal-body">
//               A new version of SyncPoint is ready. To update safely, please
//               sync any pending transactions, log out, and update from the
//               sign-in screen. We'll remind you again shortly if you're not
//               ready yet.
//             </p>
//             <button
//               className="btn-primary"
//               onClick={() => setUpdateReminder({ show: false, remoteBuildId: null })}
//             >
//               OK
//             </button>
//           </div>
//         </div>
//       )}

//       {syncReminder.show && (
//         <div className="modal-overlay">
//           <div className="modal-card">
//             <div className="modal-icon">📡</div>
//             <h2 className="modal-title">You have pending transactions</h2>
//             <p className="modal-body">
//               You have {syncReminder.pendingCount} transaction(s) waiting to sync.
//               Please connect to the internet soon so they don't get stuck.
//               {syncReminder.pendingCount >= MAX_OFFLINE_PENDING &&
//                 " You've reached the maximum offline limit — you must go online to sync before creating any new transactions."}
//             </p>
//             <button
//               className="btn-primary"
//               onClick={() => setSyncReminder({ show: false, pendingCount: 0 })}
//             >
//               OK
//             </button>
//           </div>
//         </div>
//       )}
//     </BrowserRouter>
//   );
// }

// export default App;