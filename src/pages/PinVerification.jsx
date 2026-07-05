import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyWalletPin } from "../services/api";
import { readPersisted } from "../services/sessionUtils";
import { isEncryptionReady, restoreEncryption, initializeEncryption } from "../services/cryptoService";
import { startAutoSync, syncPendingTransactions } from "../services/syncService";
import { saveOfflinePinVerifier } from "../services/savePinVerifier";
import { useNetwork } from "../hooks/useNetwork";
import "../styles/auth.css";

function PinVerification() {
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const { isOffline } = useNetwork();
  const [isRestoringTransactions, setIsRestoringTransactions] = useState(false);

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
      // A quick re-lock (screen slept, app backgrounded briefly) never tore
      // down the JS runtime, so the DEK is still live in memory. In that
      // case this is just a lock-screen check, not a fresh session resume —
      // verify locally and skip re-running encryption setup or re-starting
      // auto-sync (which would otherwise register a duplicate "online"
      // listener every single unlock).
      const isQuickRelock = sessionStorage.getItem("walletLocked") === "true" && isEncryptionReady();

      let isValid;
      if (isQuickRelock) {
        isValid = await verifyOfflinePin(pin);
      } else if (isOffline) {
        isValid = await verifyOfflinePin(pin);
      } else {
        isValid = await verifyWalletPin(walletId, pin);
      }

      if (!isValid) {
        setErrors({ pin: "Invalid PIN. Please try again." });
        setPin("");
        return;
      }

      sessionStorage.removeItem("walletLocked");

      if (isQuickRelock) {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (!isOffline) {
        await saveOfflinePinVerifier(pin);
      }

      const wrappedDEKExists = !!localStorage.getItem("wrappedDEK");
      if (wrappedDEKExists) {
        await restoreEncryption(pin);
      } else {
        await initializeEncryption(pin);
      }

      const pendingQuarantineSync = sessionStorage.getItem("pendingQuarantineSync") === "true";
      sessionStorage.removeItem("pendingQuarantineSync");

      if (pendingQuarantineSync && !isOffline) {
        setIsRestoringTransactions(true);
        try {
          await syncPendingTransactions();
        } catch (err) {
          console.warn("[PinVerification] Quarantine sync failed — normal auto-sync will retry:", err.message);
        } finally {
          setIsRestoringTransactions(false);
        }
      }

      if (!isOffline) {
        startAutoSync((result) => {
          console.log("[PinVerification] Auto-sync on resume:", result);
          window.dispatchEvent(new CustomEvent("sync-result", { detail: result }));
        });
      }

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

  async function verifyOfflinePin(pin) {
    const storedSalt = localStorage.getItem("pin_salt");
    const storedVerifier = localStorage.getItem("pin_verifier");

    if (!storedSalt || !storedVerifier) {
        return false;
    }

    const salt = Uint8Array.from(
        atob(storedSalt),
        c => c.charCodeAt(0)
    );

    const encoder = new TextEncoder();

    const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(pin),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: 600000,
            hash: "SHA-256",
        },
        baseKey,
        256
    );

    const verifier = btoa(
        String.fromCharCode(...new Uint8Array(derivedBits))
    );

    return verifier === storedVerifier;
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
      </div>

      {isRestoringTransactions && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ textAlign: "center" }}>
            <div className="modal-icon">🔄</div>
            <h2 className="modal-title">Auto-syncing previous transactions</h2>
            <p className="modal-body">
              We found transactions from your last session on this device.
              Please wait while we sync them — this will only take a moment.
            </p>
          </div>
        </div>
      )}

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

