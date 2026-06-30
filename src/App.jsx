import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { clearAuthSession } from "./services/sessionUtils";
import { isPWAInstalled } from "./services/deviceCompatibility";

// Pages
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

/**
 * InstallGuard — wraps any route that requires the app to be installed.
 * Sends non-installed users to /install.
 */
function InstallGuard({ children }) {
  if (!isPWAInstalled()) {
    return <Navigate to="/install" replace />;
  }
  return children;
}

function App() {
  useEffect(() => {
    function handleSessionExpired() {
      clearAuthSession();
      sessionStorage.setItem(
        "sessionExpiredMessage",
        "Your session has expired. Please sign in again."
      );
      window.location.replace("/login");
    }
    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Pre-install flow ─────────────────────────────────────────────
            / and /install are accessible WITHOUT installation.
            / is the onboarding page that explains the app.
            /install handles the beforeinstallprompt and manual instructions. */}
        <Route path="/" element={<Onboarding />} />
        <Route path="/install" element={<InstallPage />} />

        {/* ── Post-install routes ──────────────────────────────────────────
            All routes below require the app to be installed (PWA standalone
            mode). Non-installed users are redirected to /install. */}
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