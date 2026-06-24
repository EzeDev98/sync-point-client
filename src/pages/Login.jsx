import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, checkPinSet } from "../services/api";
import { initializeEncryption } from "../services/cryptoService";
import "../styles/auth.css";

function Login() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });

  const [formData, setFormData] = useState({
    phoneNumber: "",
    password: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  function validate() {
    const newErrors = {};

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!/^\d{10,11}$/.test(formData.phoneNumber.replace(/\D/g, ""))) {
      newErrors.phoneNumber = "Enter a valid phone number (10-11 digits)";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
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

    try {
      const data = await loginUser(formData.phoneNumber, formData.password);

      sessionStorage.setItem("sessionToken", data.token);
      sessionStorage.setItem("phoneNumber", data.phone_number);
      sessionStorage.setItem("username", data.username);
      sessionStorage.setItem("email", data.email);
      sessionStorage.setItem("userRefId", data.user_ref_id);
      sessionStorage.setItem("walletId", data.wallet_id);
      sessionStorage.setItem("userId", data.user_id);
      sessionStorage.setItem("firstName", data.first_name);
      sessionStorage.setItem("middleName", data.middle_name);
      sessionStorage.setItem("lastName", data.last_name);
      sessionStorage.setItem("mirrorBalance", data.mirror_balance);

      // ── Encryption initialization ────────────────────────────────────
      // This was previously missing entirely. Without this call, the DEK
      // (Data Encryption Key) used to encrypt every IndexedDB transaction
      // record is never generated, and sessionStorage["wrappedDEK"] never
      // gets created. Every subsequent call to saveTransaction/getAllTransactions
      // would throw "[IndexedDB] Encryption not ready" because there was
      // nothing for restoreEncryption() to restore on later page loads.
      //
      // initializeEncryption(data.token):
      //   1. Generates a fresh random 256-bit DEK
      //   2. Derives a KEK from data.token via PBKDF2
      //   3. Wraps the DEK with the KEK and stores the wrapped form in
      //      sessionStorage["wrappedDEK"]
      //   4. Holds the raw (unwrapped) DEK in cryptoService's module memory
      //      for the rest of this session
      //
      // This must run with the SAME token value that Dashboard.jsx (and any
      // other page) will later pass to restoreEncryption() after a reload —
      // both read sessionStorage["token"], so they're now consistent.
      await initializeEncryption(data.token);

      const pinSet = await checkPinSet(data.wallet_id);

      if (pinSet === false) {
        setShowPinModal(true);
      } else {
        navigate("/verifypin");
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorModal({
        show: true,
        message: err.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-field">
              <label htmlFor="phoneNumber">Phone Number</label>
              <div className="input-wrapper">
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="08012345678"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className={errors.phoneNumber ? "has-error" : ""}
                />
              </div>
              {errors.phoneNumber && (
                <p className="field-error">{errors.phoneNumber}</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? "has-error" : "password-field"}
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
              {errors.password && (
                <p className="field-error">{errors.password}</p>
              )}
            </div>

            <div
              className="form-options-row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span>Remember me</span>
              </label>

              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>
          </div>

          {errors.general && (
            <p className="field-error">{errors.general}</p>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-links">
          <p className="auth-footer-text">
            Don't have an account?
            <Link to="/register" className="auth-link">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* PIN setup modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">🔐</div>
            <h2 className="modal-title">Set your transaction PIN</h2>
            <p className="modal-body">
              To keep your wallet secure, you need to set a 4-digit transaction
              PIN before you can access your dashboard.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate("/set-pin")}
            >
              Set PIN now
            </button>
          </div>
        </div>
      )}

      {/* Error modal */}
      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Login Failed</h2>
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

export default Login;