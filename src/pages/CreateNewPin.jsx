import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completePinReset } from "../services/api";
import { useNetwork } from "../hooks/useNetwork";
import { saveOfflinePinVerifier } from "../services/savePinVerifier.js";
import { initializeEncryption } from "../services/cryptoService";
import { clearPinResetState, getPinResetToken, hasPinResetToken } from "../services/pinResetState";
import "../styles/auth.css";

function CreateNewPin() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const resetToken = getPinResetToken();

  const [formData, setFormData] = useState({ pin: "", confirmNewPin: "" });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  // A user must not be able to reach this step without a valid reset
  // token from a completed OTP verification.
  useEffect(() => {
    if (!hasPinResetToken()) {
      navigate("/forgot-pin", { replace: true });
    }
  }, [navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (!/^\d*$/.test(value) || value.length > 4) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate() {
    const newErrors = {};
    if (!formData.pin || formData.pin.length < 4) {
      newErrors.pin = "PIN must be exactly 4 digits";
    }
    if (!formData.confirmNewPin) {
      newErrors.confirmNewPin = "Please confirm your PIN";
    } else if (formData.confirmNewPin !== formData.pin) {
      newErrors.confirmNewPin = "PINs do not match";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate("/offline", { state: { returnTo: "/forgot-pin/reset" } });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Same three calls as SetPin.jsx's first-time flow — a PIN reset
      // is, on the client, just "set the PIN again": the server-side
      // resetToken is what proves this is authorized, and a fresh DEK is
      // safe to generate here because ForgotPin.jsx already confirmed
      // there's no unsynced offline data tied to the old one.
      await completePinReset(resetToken, formData.pin, formData.confirmNewPin);
      await saveOfflinePinVerifier(formData.pin);
      await initializeEncryption(formData.pin);
      clearPinResetState();
      setSuccessModal(true);
    } catch (err) {
      setErrors({ general: err.message || "Failed to reset PIN. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔐</div>
          <h1 className="auth-title">Create a new PIN</h1>
          <p className="auth-subtitle">Choose a new 4-digit transaction PIN</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="pin">New Transaction PIN</label>
              <div className="input-wrapper">
                <input
                  type={showPin ? "text" : "password"}
                  id="pin"
                  name="pin"
                  placeholder="• • • •"
                  value={formData.pin}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={4}
                  className={errors.pin ? "has-error" : ""}
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
              {errors.pin && <p className="field-error">{errors.pin}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="confirmNewPin">Confirm New PIN</label>
              <div className="input-wrapper">
                <input
                  type={showConfirmNewPin ? "text" : "password"}
                  id="confirmNewPin"
                  name="confirmNewPin"
                  placeholder="• • • •"
                  value={formData.confirmNewPin}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={4}
                  className={errors.confirmNewPin ? "has-error" : ""}
                  style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmNewPin((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmNewPin ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmNewPin && <p className="field-error">{errors.confirmNewPin}</p>}
            </div>

            <p className="field-hint" style={{ textAlign: "center" }}>
              Avoid simple PINs like 1234 or 0000
            </p>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Resetting PIN..." : "Confirm New PIN"}
          </button>
        </form>
      </div>

      {successModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">✅</div>
            <h2 className="modal-title">PIN reset successful</h2>
            <p className="modal-body">
              Your transaction PIN has been updated. Please verify your new
              PIN to unlock your wallet.
            </p>
            <button className="btn-primary" onClick={() => navigate("/verifypin", { replace: true })}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateNewPin;