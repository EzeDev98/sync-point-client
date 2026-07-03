import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { clearAuthSession } from "./services/sessionUtils";
import { isPWAInstalled } from "./services/deviceCompatibility";

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


function InstallGuard({ children }) {
  if (!isPWAInstalled()) {
    return <Navigate to="/install" replace />;
  }
  return children;
}

function App() {

  useEffect(() => {
    function handleSessionExpired() {
      clearTokenSession();
      sessionStorage.setItem(
        "sessionExpiredMessage",
        "Your session has expired. Please sign in again."
      );
      window.location.replace("/login");
    }
    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

  // Update checks intentionally do NOT happen anywhere in App.jsx.
  // Users only ever see the update prompt at /login (see Login.jsx),
  // where it's guaranteed safe: logout guarantees zero pending
  // transactions before a user can reach that screen. Checking or
  // prompting for updates from any authenticated route risks
  // triggering hardReset's destructive wipe while offline transactions
  // are still sitting unsynced in IndexedDB.

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
        <Route path="/dashboard" element={<InstallGuard><Dashboard /></InstallGuard>} />
        <Route path="/fund" element={<InstallGuard><FundWallet /></InstallGuard>} />
        <Route path="/receive" element={<InstallGuard><ReceivePayment /></InstallGuard>} />
        <Route path="/send" element={<InstallGuard><SendMoney /></InstallGuard>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;







// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { useEffect, useState } from "react";
// import { clearAuthSession } from "./services/sessionUtils";
// import { isPWAInstalled } from "./services/deviceCompatibility";
// import { checkForUpdate, markPromptSeen } from "./services/versionService";
// import { performHardReset } from "./services/hardReset";
// import { getIsOnline } from "./services/networkService";
// import UpdateModal from "./components/UpdateModal";

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


// function InstallGuard({ children }) {
//   if (!isPWAInstalled()) {
//     return <Navigate to="/install" replace />;
//   }
//   return children;
// }

// function App() {

//   useEffect(() => {
//     function handleSessionExpired() {
//       clearAuthSession();
//       sessionStorage.setItem(
//         "sessionExpiredMessage",
//         "Your session has expired. Please sign in again."
//       );
//       window.location.replace("/login");
//     }
//     window.addEventListener("session-expired", handleSessionExpired);
//     return () => window.removeEventListener("session-expired", handleSessionExpired);
//   }, []);

//   // ── App-level update polling (NEW) ────────────────────────────────────────
//   // Root cause of "update prompt inconsistent": Login.jsx only checks for
//   // updates when it mounts, which for an already-logged-in user may never
//   // happen again until they log out. This adds an independent, additive
//   // check that lives for the whole app lifetime, using the exact same
//   // versionService / hardReset / UpdateModal as Login.jsx already does.
//   // Login.jsx is untouched — its own on-mount check still runs exactly as
//   // before. markPromptSeen() is keyed by remoteBuildId in sessionStorage,
//   // so whichever check fires first "claims" that build and the other
//   // naturally skips it — no double-prompting.
//   const [updateInfo, setUpdateInfo] = useState({ show: false, remoteBuildId: null });
//   const [isUpdating, setIsUpdating] = useState(false);

//   useEffect(() => {
//     let cancelled = false;

//     async function poll() {
//       if (!getIsOnline()) return;
//       try {
//         const { updateAvailable, remoteBuildId } = await checkForUpdate();
//         if (!cancelled && updateAvailable) {
//           setUpdateInfo({ show: true, remoteBuildId });
//         }
//       } catch (err) {
//         console.warn("[App] Update check failed:", err);
//       }
//     }

//     poll();

//     const intervalId = setInterval(poll, 5 * 60 * 1000); 
//     function handleVisibility() {
//       if (document.visibilityState === "visible") poll();
//     }
//     document.addEventListener("visibilitychange", handleVisibility);

//     return () => {
//       cancelled = true;
//       clearInterval(intervalId);
//       document.removeEventListener("visibilitychange", handleVisibility);
//     };
//   }, []);

//   function handleUpdateLater() {
//     if (updateInfo.remoteBuildId) markPromptSeen(updateInfo.remoteBuildId);
//     setUpdateInfo({ show: false, remoteBuildId: null });
//   }

//   async function handleUpdateNow() {
//     setIsUpdating(true);
//     try {
//       await performHardReset(); 
//     } catch (err) {
//       console.error("[App] Hard reset failed:", err);
//       setIsUpdating(false);
//       setUpdateInfo({ show: false, remoteBuildId: null });
//     }
//   }

//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<Onboarding />} />
//         <Route path="/install" element={<InstallPage />} />
//         <Route path="/welcome" element={<InstallGuard><Welcome /></InstallGuard>} />
//         <Route path="/offline" element={<InstallGuard><Offline /></InstallGuard>} />
//         <Route path="/register" element={<InstallGuard><Register /></InstallGuard>} />
//         <Route path="/login" element={<InstallGuard><Login /></InstallGuard>} />
//         <Route path="/set-pin" element={<InstallGuard><SetPin /></InstallGuard>} />
//         <Route path="/verifypin" element={<InstallGuard><PinVerification /></InstallGuard>} />
//         <Route path="/dashboard" element={<InstallGuard><Dashboard /></InstallGuard>} />
//         <Route path="/fund" element={<InstallGuard><FundWallet /></InstallGuard>} />
//         <Route path="/receive" element={<InstallGuard><ReceivePayment /></InstallGuard>} />
//         <Route path="/send" element={<InstallGuard><SendMoney /></InstallGuard>} />

//         {/* Catch-all */}
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>

//       {updateInfo.show && (
//         <UpdateModal
//           onLater={handleUpdateLater}
//           onUpdate={handleUpdateNow}
//           isUpdating={isUpdating}
//         />
//       )}
//     </BrowserRouter>
//   );
// }

// export default App;