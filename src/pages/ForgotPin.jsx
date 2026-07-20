import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPinResetOtp } from "../services/api";
import { readPersisted } from "../services/sessionUtils";
import { getPendingCount } from "../services/indexedDbService";
import { useNetwork } from "../hooks/useNetwork";
import { markOtpRequested } from "../services/PinResetState";
import "../styles/auth.css";

function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return "";
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 6) return phoneNumber;
  const start = digits.slice(0, 3);
  const end = digits.slice(-2);
  return `${start}${"*".repeat(digits.length - 5)}${end}`;
}

function ForgotPin() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = readPersisted("phoneNumber");

  const [isChecking, setIsChecking] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [checkFailed, setCheckFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // PIN reset must be blocked while there are unsynced offline
  // transactions: they were encrypted with the key derived from the PIN
  // the user is about to replace, and once it's replaced there is no way
  // to decrypt or sync them — not "wait and retry," permanently. Checked
  // here (not just at the "Forgot PIN?" link) so directly navigating to
  // this route can't bypass the gate.
  //
  // Fails CLOSED on error: if we can't determine the pending count, we
  // must not assume it's safe to proceed.
  useEffect(() => {
    async function checkPending() {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
      } catch (err) {
        console.error("[ForgotPin] Failed to check pending transactions:", err);
        setCheckFailed(true);
      } finally {
        setIsChecking(false);
      }
    }
    checkPending();
  }, []);

  async function handleSendCode() {
    if (isOffline) {
      navigate("/offline", { state: { returnTo: "/forgot-pin" } });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      await requestPinResetOtp(phoneNumber);
      markOtpRequested();
      navigate("/forgot-pin/verify");
    } catch (err) {
      setErrors({ general: err.message || "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 16 }}>
            Checking for unsynced transactions...
          </p>
        </div>
      </div>
    );
  }

  if (pendingCount > 0 || checkFailed) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <h1 className="auth-title">Can't reset your PIN yet</h1>
          </div>
          {checkFailed ? (
            <p className="modal-body" style={{ textAlign: "center" }}>
              We couldn't verify whether this device has unsynced transactions, so PIN reset is
              blocked as a precaution. Please try again, or contact support if this continues.
            </p>
          ) : (
            <>
              <p className="modal-body" style={{ textAlign: "center" }}>
                You have {pendingCount} unsynced transaction{pendingCount === 1 ? "" : "s"} on this
                device that can only be read and sent using your current PIN. Resetting your PIN now
                would make {pendingCount === 1 ? "it" : "them"} permanently unrecoverable.
              </p>
              <p className="field-hint" style={{ textAlign: "center", marginTop: 8 }}>
                If you still remember your current PIN, unlock your wallet and stay online for a
                moment to let it sync, then try again. If you don't remember it, please contact
                support instead — this device's unsynced transactions cannot be recovered otherwise.
              </p>
            </>
          )}
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/verifypin")}>
            Back to Unlock Screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Reset your PIN</h1>
          <p className="auth-subtitle">
            We'll send a verification code to your registered phone number:{" "}
            <strong>{maskPhoneNumber(phoneNumber)}</strong>
          </p>
        </div>

        {errors.general && <p className="field-error">{errors.general}</p>}

        <button type="button" className="btn-primary" onClick={handleSendCode} disabled={isSubmitting}>
          {isSubmitting ? "Sending code..." : "Send OTP"}
        </button>

        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
            onClick={() => navigate("/verifypin")}
          >
            Back to Unlock Screen
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForgotPin;