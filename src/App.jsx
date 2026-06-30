import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Register from "./pages/Register";
import Login from "./pages/Login";
import SetPin from "./pages/SetPin";
import Dashboard from "./pages/Dashboard";
import FundWallet from "./pages/FundWallet";
import ReceivePayment from "./pages/ReceivePayment";
import SendMoney from "./pages/SendMoney";
import PinVerification from "./pages/PinVerification";
import Welcome from "./pages/Welcome";
import Offline from "./pages/Offline";
import InstallationFlow from "./pages/InstallationFlow";
import InstallGuard from "./components/InstallGuard";
import AuthGuard from "./components/AuthGuard";
import { clearAuthSession } from "./services/sessionUtils";

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
        {/* Public routes - always accessible */}
        <Route path="/install" element={<InstallationFlow />} />
        <Route path="/offline" element={<Offline />} />
        
        {/* Routes that require installation */}
        <Route path="/" element={
          <InstallGuard>
            <Navigate to="/welcome" replace />
          </InstallGuard>
        } />
        <Route path="/welcome" element={
          <InstallGuard>
            <Welcome />
          </InstallGuard>
        } />
        <Route path="/register" element={
          <InstallGuard>
            <Register />
          </InstallGuard>
        } />
        <Route path="/login" element={
          <InstallGuard>
            <Login />
          </InstallGuard>
        } />
        
        {/* Routes that require installation AND authentication */}
        <Route path="/set-pin" element={
          <InstallGuard>
            <AuthGuard>
              <SetPin />
            </AuthGuard>
          </InstallGuard>
        } />
        <Route path="/verifypin" element={
          <InstallGuard>
            <AuthGuard>
              <PinVerification />
            </AuthGuard>
          </InstallGuard>
        } />
        <Route path="/dashboard" element={
          <InstallGuard>
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          </InstallGuard>
        } />
        <Route path="/fund" element={
          <InstallGuard>
            <AuthGuard>
              <FundWallet />
            </AuthGuard>
          </InstallGuard>
        } />
        <Route path="/receive" element={
          <InstallGuard>
            <AuthGuard>
              <ReceivePayment />
            </AuthGuard>
          </InstallGuard>
        } />
        <Route path="/send" element={
          <InstallGuard>
            <AuthGuard>
              <SendMoney />
            </AuthGuard>
          </InstallGuard>
        } />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;