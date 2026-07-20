import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPasswordResetOtp, verifyPasswordResetOtp } from "../services/api";
import { useNetwork } from "../hooks/useNetwork";
import {
  getPhoneNumber,
  hasRequestedOtp,
  maskPhoneNumber,
  setResetToken,
} from "../services/PasswordResetState";
import "../styles/auth.css";

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyResetOtp() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = getPhoneNumber();

  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // A user should not be able to land on this step directly without
  // having gone through the Forgot Password step first.
  useEffect(() => {
    if (!hasRequestedOtp()) {
      navigate("/forgot-password", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function handleChange(e) {
    const value = e.target.value.replace(/\D/g, "");
    setOtp(value);
    if (errors.otp) setErrors((prev) => ({ ...prev, otp: "" }));
  }

  function validate() {
    const newErrors = {};
    if (!otp) {
      newErrors.otp = "Verification code is required";
    } else if (!/^\d{6}$/.test(otp)) {
      newErrors.otp = "The verification code is invalid";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate("/offline", { state: { returnTo: "/forgot-password/verify" } });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const data = await verifyPasswordResetOtp(phoneNumber, otp);
      setResetToken(data.resetToken);
      navigate("/forgot-password/reset");
    } catch (err) {
      setErrors({ general: err.message || "The verification code is invalid." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setErrors({});

    try {
      await requestPasswordResetOtp(phoneNumber);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err.status === 429 && err.remainingSeconds) {
        setResendCooldown(err.remainingSeconds);
      }
      setErrors({ general: err.message || "Could not resend code. Please try again." });
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Verify your phone number</h1>
          <p className="auth-subtitle">
            Enter the verification code sent to: <strong>{maskPhoneNumber(phoneNumber)}</strong>
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="otp">Verification Code</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="otp"
                  name="otp"
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={errors.otp ? "has-error" : ""}
                  style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                />
              </div>
              {errors.otp && <p className="field-error">{errors.otp}</p>}
            </div>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <div className="auth-links">
          {resendCooldown > 0 ? (
            <p className="auth-footer-text">Resend code in {resendCooldown}s</p>
          ) : (
            <button
              type="button"
              className="auth-link"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? "Resending..." : "Resend code"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyResetOtp;