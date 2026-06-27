import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyWalletPin } from "../services/api";
import { clearAuthSession, readPersisted } from "../services/sessionUtils";
import { restoreEncryption, initializeEncryption } from "../services/cryptoService";
import { startAutoSync } from "../services/syncService";
import "../styles/auth.css";

function PinVerification() {
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });

  // Read walletId from localStorage (persisted across app closure)
  const walletId = readPersisted("walletId");

  useEffect(() => {
    if (!walletId) {
      navigate("/login", { replace: true });
    }
  }, [walletId, navigate]);

  // Restore sessionStorage identity fields from localStorage on mount.
  // Covers the case where the app was closed and reopened.
  //
  // Note: offlineBalance is intentionally NOT restored here.
  // The offline balance is always derived from IndexedDB via walletLedger,
  // so there is no longer a canonical "offlineBalance" value in any
  // storage location — it would immediately be stale.
  useEffect(() => {
    const persistedKeys = [
      "walletId", "userId", "phoneNumber", "username", "email",
      "userRefId", "firstName", "middleName", "lastName",
      "mirrorBalance",
    ];

    for (const key of persistedKeys) {
      const value = localStorage.getItem(key);
      if (value && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, value);
      }
    }
  }, []);

  function handlePinChange(e) {
    const value = e.target.value;
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

       // ── Restore encryption context ─────────────────────────────────────
      // After app closure the access token is gone but wrappedDEK in
      // localStorage can be unwrapped using the new access token we just
      // obtained via refreshOnStartup() in Login.jsx.
      const wrappedDEKExists = !!localStorage.getItem("wrappedDEK");
      if (wrappedDEKExists) {
        await restoreEncryption(pin);
      } else {
        await initializeEncryption(pin);
      }

      // ── Store PIN verification proof ───────────────────────────────────
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const encoder = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        "raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
        baseKey, 256
      );
      sessionStorage.setItem("pin_salt", btoa(String.fromCharCode(...salt)));
      sessionStorage.setItem("pin_verifier", btoa(String.fromCharCode(...new Uint8Array(derivedBits))));
      sessionStorage.setItem("pin_verified_at", Date.now().toString());

      // ── Restart auto-sync scheduler ────────────────────────────────────
      // startAutoSync listens for the "online" event and processes pending
      // transactions. We kick it off here so it starts immediately after
      // the wallet is unlocked without requiring a full login.
      startAutoSync((result) => {
        console.log("[PinVerification] Auto-sync on resume:", result);
        window.dispatchEvent(new CustomEvent("sync-result", { detail: result }));
      });

      navigate("/dashboard", { replace: true });

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
    clearAuthSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Enter Your PIN</h1>
          <p className="auth-subtitle">
            Enter your 4-digit PIN to unlock your wallet
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
                  style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20, fontWeight: 500 }}
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
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting || pin.length < 4}>
            {isSubmitting ? "Unlocking..." : "Unlock Wallet"}
          </button>
        </form>

        <div className="auth-links">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="auth-link"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            ← Sign in with a different account
          </button>
        </div>
      </div>

      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Verification Failed</h2>
            <p className="modal-body">{errorModal.message}</p>
            <button className="btn-primary" onClick={() => setErrorModal({ show: false, message: "" })}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PinVerification;

