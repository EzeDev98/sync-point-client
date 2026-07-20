import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completePasswordReset } from "../services/api";
import { useNetwork } from "../hooks/useNetwork";
import { clearPasswordResetState, getResetToken, hasResetToken, } from "../services/PasswordResetState";
import "../styles/auth.css";

function CreateNewPassword() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const resetToken = getResetToken();

  const [formData, setFormData] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  // A user must not be able to reach this step without a valid reset
  // token from a completed OTP verification.
  useEffect(() => {
    if (!hasResetToken()) {
      navigate("/forgot-password", { replace: true });
    }
  }, [navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate() {
    const newErrors = {};
    if (!formData.newPassword) {
      newErrors.newPassword = "Password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.confirmPassword !== formData.newPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate("/offline", { state: { returnTo: "/forgot-password/reset" } });
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
      await completePasswordReset(resetToken, formData.newPassword, formData.confirmPassword);
      clearPasswordResetState();
      setSuccessModal(true);
    } catch (err) {
      if (err.status === 400 && /expired|start again/i.test(err.message || "")) {
        clearPasswordResetState();
      }
      setErrors({ general: err.message || "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Create a new password</h1>
          <p className="auth-subtitle">Choose a strong password for your account.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="newPassword">New Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  placeholder="Enter your new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={errors.newPassword ? "has-error" : "password-field"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.newPassword && <p className="field-error">{errors.newPassword}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Re-enter your new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? "has-error" : "password-field"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
            </div>

            <p className="field-hint">Must be at least 8 characters.</p>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Resetting password..." : "Reset Password"}
          </button>
        </form>
      </div>

      {successModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">✅</div>
            <h2 className="modal-title">Password reset successful</h2>
            <p className="modal-body">
              Your password has been updated. For your security, you've been
              signed out everywhere and will need to sign in again.
            </p>
            <button className="btn-primary" onClick={() => navigate("/login", { replace: true })}>
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateNewPassword;