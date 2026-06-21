import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fundOfflineWallet, transferToOnline } from "../services/api";
import "../styles/auth.css";

function FundWallet() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("offline");
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    transactionPin: "",
  });
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState({ show: false, message: "" });
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });

  const [requestRef, setRequestRef] = useState(null);

  function generateRequestRef() {
    return (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  // Get current offline balance from sessionStorage
  const getCurrentOfflineBalance = () => {
    return Number(sessionStorage.getItem("offlineBalance") || 0);
  };

  function handleChange(e) {
    const { name, value } = e.target;

    // PIN: only digits, max 4
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
    const currentBalance = getCurrentOfflineBalance();

    if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) {
      newErrors.amount = "Enter a valid amount";
    } else if (Number(formData.amount) < 100) {
      newErrors.amount = "Minimum transfer amount is ₦100";
    }

       // For online tab, check if amount exceeds offline balance
    if (activeTab === "online" && Number(formData.amount) > currentBalance) {
      newErrors.amount = `Insufficient offline balance. You have ₦${currentBalance.toLocaleString()}`;
    }

    if (!formData.transactionPin || formData.transactionPin.length < 4) {
      newErrors.transactionPin = "Enter your 4-digit transaction PIN";
    }

    return newErrors;
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

    if (!requestRef) {
      setRequestRef(newRef);
    }

    try {
      const amount = Number(formData.amount);
      const payload = {
        amount: amount,
        description: formData.description || null,
        transactionPin: formData.transactionPin,
        requestRef: newRef,
      };

      if (activeTab === "offline") {
        await fundOfflineWallet(payload);
       
        const currentBalance = getCurrentOfflineBalance();
        const newBalance = currentBalance + amount;
        sessionStorage.setItem("offlineBalance", newBalance.toString());

        setSuccessModal({
          show: true,
          message: `₦${amount.toLocaleString()} has been added to your offline wallet successfully. New balance: ₦${newBalance.toLocaleString()}`,
        });
      } else {
        await transferToOnline(payload);
        
        const currentBalance = getCurrentOfflineBalance();
        const newBalance = currentBalance - amount;
        sessionStorage.setItem("offlineBalance", newBalance.toString());
        
        setSuccessModal({
          show: true,
          message: `₦${amount.toLocaleString()} has been transferred to your online account successfully. Remaining offline balance: ₦${newBalance.toLocaleString()}`,
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
  const currentOfflineBalance = getCurrentOfflineBalance();

  return (
    <div className="sp-app">
      {/* HEADER */}
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={16} strokeWidth={1.8} />
        </button>
        <span className="page-title">
          {isOffline ? "Fund Offline Wallet" : "Transfer to Online Account"}
        </span>
      </div>

      <div className="page-body">
        {/* Current Offline Balance Display */}
        <div className="info-banner" style={{ background: "#F0FDF9", borderColor: "#9FE1CB" }}>
          <strong>Current Offline Balance:</strong> ₦{currentOfflineBalance.toLocaleString()}
        </div>

        {/* TAB SELECTOR */}
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

        {/* INFO BANNER */}
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
              <strong>Available to transfer: ₦{currentOfflineBalance.toLocaleString()}</strong>
            </>
          )}
        </div>

        {/* FORM */}
        <form className="form-section" onSubmit={handleSubmit} noValidate>
          {/* AMOUNT */}
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
                max={!isOffline ? currentOfflineBalance : undefined}
              />
            </div>
            {errors.amount ? (
              <p className="field-error">{errors.amount}</p>
            ) : (
              <p className="field-hint">
                {isOffline 
                  ? "Minimum transfer: ₦100" 
                  : `Maximum transfer: ₦${currentOfflineBalance.toLocaleString()}`}
              </p>
            )}
          </div>

          {/* DESCRIPTION */}
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

          {/* PIN */}
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

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting
              ? "Processing..."
              : isOffline
              ? "Fund Offline Wallet"
              : "Transfer to Online"}
          </button>
        </form>
      </div>

      {/* SUCCESS MODAL */}
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

      {/* ERROR MODAL */}
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