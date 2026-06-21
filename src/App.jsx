import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login"; 
import SetPin from "./pages/SetPin";
import Dashboard from "./pages/Dashboard";
import FundWallet from "./pages/FundWallet";
import ReceivePayment from "./pages/ReceivePayment";
import SendMoney from "./pages/SendMoney";
import PinVerification from "./pages/PinVerification";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/set-pin" element={<SetPin />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/fund" element={<FundWallet />} />
        <Route path="/receive" element={<ReceivePayment />} />
        <Route path="/send" element={<SendMoney />} />
        <Route path="/verifypin" element={<PinVerification />} />
        <Route path="/" element={<Navigate to="/register" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;