import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyWalletPin } from "../services/api";
import "../styles/auth.css";

function PinVerification() {
  const navigate = useNavigate();
  
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });

  // Get walletId from sessionStorage (set during login)
  const walletId = sessionStorage.getItem("walletId");

  // Redirect if no walletId (shouldn't happen, but safety)
  useEffect(() => {
    if (!walletId) {
      navigate("/login");
    }
  }, [walletId, navigate]);

  function handlePinChange(e) {
    const value = e.target.value;
    // Only allow digits, max 4 characters
    if (!/^\d*$/.test(value) || value.length > 4) return;
    setPin(value);
    if (errors.pin) setErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();

     if (!pin || pin.length < 4) {
      setErrors({ pin: "Enter your 4-digit PIN" });
      return;
    }

    setIsSubmitting(true);

    try {
      
        const isValid = await verifyWalletPin(walletId, pin);

        if (!isValid) {
            setErrors({ pin: "Invalid PIN. Please try again." });
            setPin("");
            return;
        }

        const salt = crypto.getRandomValues(new Uint8Array(32));
        const encoder = new TextEncoder();
        const pinBuffer = encoder.encode(pin);
        
        const baseKey = await crypto.subtle.importKey(
          'raw',
          pinBuffer,
          'PBKDF2',
          false,
          ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 600000,
            hash: 'SHA-256',
          },
          baseKey,
          256
        );
        
        const verifier = new Uint8Array(derivedBits);
        
        // Store in sessionStorage (cleared on logout/tab close)
        sessionStorage.setItem('pin_salt', btoa(String.fromCharCode(...salt)));
        sessionStorage.setItem('pin_verifier', btoa(String.fromCharCode(...verifier)));
        sessionStorage.setItem('pin_verified_at', Date.now().toString());
        
        // Redirect to dashboard
        navigate("/dashboard");
      
    } catch (err) {
      console.error("PIN verification error:", err);
      setErrorModal({
        show: true,
        message: err.message || "Unable to verify PIN. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToLogin() {
    // Clear any existing session data
    sessionStorage.clear();
    navigate("/login");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Verify Transaction PIN</h1>
          <p className="auth-subtitle">
            Enter your 4-digit PIN to access your wallet
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="pin">Transaction PIN</label>
              <div className="input-wrapper">
                <input
                  type={showPin ? "text" : "password"}
                  id="pin"
                  name="pin"
                  placeholder="• • • •"
                  value={pin}
                  onChange={handlePinChange}
                  inputMode="numeric"
                  maxLength={4}
                  className={errors.pin ? "has-error" : ""}
                  style={{
                    letterSpacing: "0.4em",
                    textAlign: "center",
                    fontSize: 20,
                    fontWeight: 500,
                  }}
                  autoFocus
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
              <label htmlFor="confirmPin">Confirm PIN</label>
              <div className="input-wrapper">
                <input
                  type={showConfirmPin ? "text" : "password"}
                  id="confirmPin"
                  name="confirmPin"
                  placeholder="• • • •"
                  inputMode="numeric"
                  maxLength={4}
                  className={errors.confirmPin ? "has-error" : ""}
                  style={{
                    letterSpacing: "0.4em",
                    textAlign: "center",
                    fontSize: 20,
                    fontWeight: 500,
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPin((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmPin ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmPin && (
                <p className="field-error">{errors.confirmPin}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || pin.length < 4}
          >
            {isSubmitting ? "Verifying..." : "Verify & Continue"}
          </button>
        </form>

        <div className="auth-links">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="auth-link"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            ← Back to Login
          </button>
        </div>
      </div>

      {/* Error Modal */}
      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Verification Failed</h2>
            <p className="modal-body">{errorModal.message}</p>
            <button
              className="btn-primary"
              onClick={() => setErrorModal({ show: false, message: "" })}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PinVerification;