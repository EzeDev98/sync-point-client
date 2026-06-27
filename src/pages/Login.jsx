import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, checkPinSet } from "../services/api";
import { persistValue, hasResumableSession } from "../services/sessionUtils";
import { refreshOnStartup } from "../services/token";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [formData, setFormData] = useState({
    phoneNumber: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Startup check: resume session if possible ────────────────────────────
  useEffect(() => {
    async function checkExistingSession() {
      if (!hasResumableSession()) {
        setIsCheckingSession(false);
        return;
      }

      try {
        // Refresh token exists — get a new access token silently
        await refreshOnStartup();
        // Success — go straight to PIN verification
        navigate("/verifypin", { replace: true });
      } catch {
        // Refresh token is expired or invalid — show login normally
        setIsCheckingSession(false);
      }
    }

    checkExistingSession();
  }, [navigate]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
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

      // ── Persistent identity (survives app closure) ─────────────────────
      persistValue("walletId", data.wallet_id);
      persistValue("userId", data.user_id);
      persistValue("phoneNumber", data.phone_number);
      persistValue("username", data.username);
      persistValue("email", data.email);
      persistValue("userRefId", data.user_ref_id);
      persistValue("firstName", data.first_name);
      persistValue("middleName", data.middle_name);
      persistValue("lastName", data.last_name);
      persistValue("mirrorBalance", data.mirror_balance);
      persistValue("refreshToken", data.refreshToken);
      persistValue("refreshTokenExpiresIn", data.refreshTokenExpiresIn);
      persistValue("tokenIssuedAt", Date.now().toString());

      // ── Temporary session (gone on tab close) ──────────────────────────
      sessionStorage.setItem("sessionToken", data.token);
      sessionStorage.setItem("accessTokenExpiresIn", data.accessTokenExpiresIn);

      // Mirror persistent values into sessionStorage so existing code that
      // reads sessionStorage.getItem("walletId") etc. keeps working
      sessionStorage.setItem("walletId", data.wallet_id);
      sessionStorage.setItem("userId", data.user_id);
      sessionStorage.setItem("phoneNumber", data.phone_number);
      sessionStorage.setItem("username", data.username);
      sessionStorage.setItem("email", data.email);
      sessionStorage.setItem("userRefId", data.user_ref_id);
      sessionStorage.setItem("firstName", data.first_name);
      sessionStorage.setItem("middleName", data.middle_name);
      sessionStorage.setItem("lastName", data.last_name);

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

  // Show nothing while checking for an existing session
  if (isCheckingSession) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#6B7280", fontSize: 14 }}>Checking session...</p>
        </div>
      </div>
    );
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
              {errors.phoneNumber && <p className="field-error">{errors.phoneNumber}</p>}
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
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            <div className="form-options-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
            </div>
          </div>

          {errors.general && <p className="field-error">{errors.general}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-links">
          <p className="auth-footer-text">
            Don't have an account?{" "}
            <Link to="/register" className="auth-link">Create account</Link>
          </p>
        </div>
      </div>

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">🔐</div>
            <h2 className="modal-title">Set your transaction PIN</h2>
            <p className="modal-body">
              To keep your wallet secure, you need to set a 4-digit transaction PIN
              before you can access your dashboard.
            </p>
            <button className="btn-primary" onClick={() => navigate("/set-pin")}>
              Set PIN now
            </button>
          </div>
        </div>
      )}

      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Login Failed</h2>
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

export default Login;