import { BrowserRouter, Routes, Route } from "react-router-dom";
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
        <Route path="/" element={<Welcome />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/offline" element={<Offline />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/set-pin" element={<SetPin />} />
        <Route path="/verifypin" element={<PinVerification />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/fund" element={<FundWallet />} />
        <Route path="/receive" element={<ReceivePayment />} />
        <Route path="/send" element={<SendMoney />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;