import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fundOfflineWallet, transferToOnline } from "../services/api";
import { saveLedgerTransaction } from "../services/indexedDbService";
import { calculateOfflineBalance } from "../services/walletLedger";
import "../styles/auth.css";

function FundWallet() {
  const navigate = useNavigate();
  const location = useLocation();

  const logoutBlockedMessage = sessionStorage.getItem("logoutBlockedMessage") || "";

  const [activeTab, setActiveTab] = useState(() => {
    if (location.state?.fromLogout || location.state?.autoTab === "online") {
      sessionStorage.removeItem("logoutBlockedMessage");
      return "online";
    }
    return "offline";
  });

  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);

  // Load ledger balance on mount
  useState(() => {
    calculateOfflineBalance()
      .then((bal) => {
        setCurrentBalance(bal);
        setBalanceLoaded(true);
      })
      .catch(() => setBalanceLoaded(true));
  });

  const [formData, setFormData] = useState({ amount: "", description: "", transactionPin: "" });
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState({ show: false, message: "" });
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [requestRef, setRequestRef] = useState(null);

  function generateRequestRef() {
    return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "transactionPin") {
      if (!/^\d*$/.test(value) || value.length > 4) return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handleTabSwitch(tab) {
    setActiveTab(tab);
    setFormData({ amount: "", description: "", transactionPin: "" });
    setErrors({});
    setRequestRef(null);
  }

  function validate() {
    const newErrors = {};
    const amount = Number(formData.amount);

    if (!formData.amount || isNaN(amount) || amount <= 0) {
      newErrors.amount = "Enter a valid amount";
    } else if (amount < 100) {
      newErrors.amount = "Minimum transfer amount is ₦100";
    }

    if (activeTab === "online" && amount > currentBalance) {
      newErrors.amount = `Insufficient offline balance. You have ₦${currentBalance.toLocaleString()}`;
    }

    if (!formData.transactionPin || formData.transactionPin.length < 4) {
      newErrors.transactionPin = "Enter your 4-digit transaction PIN";
    }

    return newErrors;
  }

  function getFullName() {
    const firstName = localStorage.getItem("firstName") || sessionStorage.getItem("firstName") || "";
    const middleName = localStorage.getItem("middleName") || sessionStorage.getItem("middleName") || "";
    const lastName = localStorage.getItem("lastName") || sessionStorage.getItem("lastName") || "";
    return [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
  }

  function saveNotification(notification) {
    const existing = JSON.parse(localStorage.getItem("notifications") || "[]");
    existing.unshift(notification);
    localStorage.setItem("notifications", JSON.stringify(existing.slice(0, 50)));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    const newRef = requestRef ?? generateRequestRef();
    if (!requestRef) setRequestRef(newRef);

    try {
      const amount = Number(formData.amount);
      const payload = {
        amount,
        description: formData.description || null,
        transactionPin: formData.transactionPin,
        requestRef: newRef,
      };

      const walletId = localStorage.getItem("walletId") || sessionStorage.getItem("walletId");
      const phoneNumber = localStorage.getItem("phoneNumber") || sessionStorage.getItem("phoneNumber");
      const fullName = getFullName();

      if (activeTab === "offline") {
        // 1. Hit the backend — confirms the debit from the online account
        await fundOfflineWallet(payload);

        // 2. Save CREDIT ledger entry into IndexedDB
        await saveLedgerTransaction({
          transactionRef: newRef,
          requestRef: newRef,
          type: "FUND",
          entryType: "CREDIT",
          status: "SUCCESS",
          amount,
          currency: "NGN",
          description: payload.description || "Offline wallet funding",
          senderWalletId: walletId,
          senderPhone: phoneNumber,
          senderName: fullName,
          receiverWalletId: walletId,
          receiverPhone: phoneNumber,
          receiverName: fullName,
          createdAt: new Date().toISOString(),
        });

        // 3. Recalculate balance from ledger
        const newBalance = await calculateOfflineBalance();
        setCurrentBalance(newBalance);

        // Notify dashboard
        window.dispatchEvent(
          new CustomEvent("balance-updated", { detail: { balance: newBalance } })
        );

        saveNotification({
          id: crypto.randomUUID(),
          type: "fund",
          read: false,
          title: "Offline Wallet Funded",
          desc: `${fullName} funded offline wallet with ₦${amount.toLocaleString()}`,
          amount,
          time: new Date().toISOString(),
        });

        setSuccessModal({
          show: true,
          message: `₦${amount.toLocaleString()} has been added to your offline wallet successfully. New balance: ₦${newBalance.toLocaleString()}`,
        });

      } else {
        // 1. Hit the backend — moves money from offline wallet to online
        await transferToOnline(payload);

        // 2. Save DEBIT ledger entry into IndexedDB
        await saveLedgerTransaction({
          transactionRef: newRef,
          requestRef: newRef,
          type: "TRANSFER_TO_ONLINE",
          entryType: "DEBIT",
          status: "SUCCESS",
          amount,
          currency: "NGN",
          description: payload.description || "Transfer to online account",
          senderWalletId: walletId,
          senderPhone: phoneNumber,
          senderName: fullName,
          receiverWalletId: walletId,
          receiverPhone: phoneNumber,
          receiverName: fullName,
          createdAt: new Date().toISOString(),
        });

        // 3. Recalculate balance from ledger
        const newBalance = await calculateOfflineBalance();
        setCurrentBalance(newBalance);

        window.dispatchEvent(
          new CustomEvent("balance-updated", { detail: { balance: newBalance } })
        );

        saveNotification({
          id: crypto.randomUUID(),
          type: "transfer",
          read: false,
          title: "Transfer To Online Account",
          desc: `${fullName} transferred ₦${amount.toLocaleString()} to online account`,
          amount,
          time: new Date().toISOString(),
        });

        setSuccessModal({
          show: true,
          message:
            newBalance === 0
              ? `₦${amount.toLocaleString()} transferred. Your offline wallet is now empty. ` +
                `Tap "Back to Dashboard" to complete logout.`
              : `₦${amount.toLocaleString()} transferred to your online account. ` +
                `Remaining offline balance: ₦${newBalance.toLocaleString()}`,
        });
      }

      setFormData({ amount: "", description: "", transactionPin: "" });
      setRequestRef(null);

    } catch (err) {
      console.error("Fund error:", err);
      setErrorModal({
        show: true,
        message: err.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isOffline = activeTab === "offline";

  return (
    <div className="sp-app">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={16} strokeWidth={1.8} />
        </button>
        <span className="page-title">
          {isOffline ? "Fund Offline Wallet" : "Transfer to Online Account"}
        </span>
      </div>

      <div className="page-body">
        {logoutBlockedMessage && (
          <div
            className="info-banner"
            style={{ background: "#FEF3C7", borderColor: "#F59E0B", color: "#92400E" }}
          >
            ⚠️ {logoutBlockedMessage}
          </div>
        )}

        <div className="info-banner" style={{ background: "#F0FDF9", borderColor: "#9FE1CB" }}>
          <strong>Current Offline Balance:</strong>{" "}
          {balanceLoaded ? `₦${currentBalance.toLocaleString()}` : "Loading..."}
        </div>

        <div className="fund-selector">
          <button
            className={`fund-tab ${activeTab === "offline" ? "active" : ""}`}
            onClick={() => handleTabSwitch("offline")}
          >
            <span className="fund-tab-label">Offline Wallet</span>
            <span className="fund-tab-desc">Top up from online</span>
          </button>
          <button
            className={`fund-tab ${activeTab === "online" ? "active" : ""}`}
            onClick={() => handleTabSwitch("online")}
          >
            <span className="fund-tab-label">Online Account</span>
            <span className="fund-tab-desc">Move to online</span>
          </button>
        </div>

        <div className="info-banner">
          {isOffline ? (
            <>
              💳 Funds will be transferred from your <strong>online account</strong> into
              your <strong>offline wallet</strong>. You can use this balance for offline
              transactions.
            </>
          ) : (
            <>
              🏦 Funds will be moved from your <strong>offline wallet</strong> back into
              your <strong>online account</strong>. This requires an internet connection.
              <br />
              <strong>Available to transfer: ₦{currentBalance.toLocaleString()}</strong>
            </>
          )}
        </div>

        <form className="form-section" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="amount">Amount</label>
            <div className="amount-wrapper">
              <span className="currency-symbol">₦</span>
              <input
                type="number"
                id="amount"
                name="amount"
                className={`amount-input ${errors.amount ? "has-error" : ""}`}
                placeholder="0.00"
                value={formData.amount}
                onChange={handleChange}
                min="0"
                max={!isOffline ? currentBalance : undefined}
              />
            </div>
            {errors.amount ? (
              <p className="field-error">{errors.amount}</p>
            ) : (
              <p className="field-hint">
                {isOffline
                  ? "Minimum transfer: ₦100"
                  : `Maximum transfer: ₦${currentBalance.toLocaleString()}`}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="description">
              Description{" "}
              <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              id="description"
              name="description"
              placeholder={isOffline ? "e.g. Weekly wallet top-up" : "e.g. Moving funds back online"}
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="transactionPin">Transaction PIN</label>
            <div className="input-wrapper">
              <input
                type={showPin ? "text" : "password"}
                id="transactionPin"
                name="transactionPin"
                placeholder="• • • •"
                value={formData.transactionPin}
                onChange={handleChange}
                inputMode="numeric"
                maxLength={4}
                className={errors.transactionPin ? "has-error" : ""}
                style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPin((prev) => !prev)}
                tabIndex={-1}
              >
                {showPin ? "Hide" : "Show"}
              </button>
            </div>
            {errors.transactionPin && (
              <p className="field-error">{errors.transactionPin}</p>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting || !balanceLoaded}>
            {isSubmitting
              ? "Processing..."
              : isOffline
              ? "Fund Offline Wallet"
              : "Transfer to Online"}
          </button>
        </form>
      </div>

      {successModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">✅</div>
            <h2 className="modal-title">Transfer Successful</h2>
            <p className="modal-body">{successModal.message}</p>
            <button
              className="btn-primary"
              onClick={() => {
                setSuccessModal({ show: false, message: "" });
                navigate("/dashboard");
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Transfer Failed</h2>
            <p className="modal-body">{errorModal.message}</p>
            <button
              className="btn-primary"
              onClick={() => setErrorModal({ show: false, message: "" })}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FundWallet;