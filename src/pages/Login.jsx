import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, checkPinSet } from "../services/api";
import { persistValue, hasResumableSession } from "../services/sessionUtils";
import { refreshOnStartup } from "../services/token";
import { useNetwork } from "../hooks/useNetwork";
import UpdateModal from "../components/UpdateModal";
import { checkForUpdate, markPromptSeen } from "../services/versionService";
import { performHardReset } from "../services/hardReset";
import "../styles/login.css";
import { getIsOnline } from "../services/networkService";

function Login() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const [showPinModal, setShowPinModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [updateInfo, setUpdateInfo] = useState({ show: false, remoteBuildId: null });
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  

  useEffect(() => {
 
    async function checkUpdateThenSession() {
      if (getIsOnline()) {
        const { updateAvailable, remoteBuildId } = await checkForUpdate();
        if (updateAvailable) {
          setUpdateInfo({ show: true, remoteBuildId });
          setIsCheckingSession(false);
          return; 
        }
      }

      // No update (or offline, where we can't check) — proceed exactly as before
      if (!hasResumableSession()) {
        setIsCheckingSession(false);
        return;
      }

      if (!getIsOnline()) {
        navigate("/verifypin", { replace: true });
        return;
      }

      try {
        await refreshOnStartup();
        navigate("/verifypin", { replace: true });
      } catch {
        setIsCheckingSession(false);
      }
    }

    checkUpdateThenSession();
  }, [navigate]);

  function handleUpdateLater() {
    if (updateInfo.remoteBuildId) markPromptSeen(updateInfo.remoteBuildId);
    setUpdateInfo({ show: false, remoteBuildId: null });
    setIsCheckingSession(false); // fall through to normal login screen
  }

  async function handleUpdateNow() {
    setIsUpdating(true);
    try {
      await performHardReset(); // navigates away; nothing after this runs
    } catch (err) {
      console.error("[Login] Hard reset failed:", err);
      setIsUpdating(false);
      setUpdateInfo({ show: false, remoteBuildId: null });
      setIsCheckingSession(false);
    }
  }

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

    if (isOffline) {
      navigate("/offline", { state: { returnTo: "/login" } });
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await loginUser(formData.phoneNumber, formData.password);

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

  if (isCheckingSession) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 16 }}>
            Checking session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header" style={{ textAlign: "center" }}>
          <h1 className="auth-title" style={{ marginTop: 12 }}>Welcome back</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        {isOffline && (
          <div style={{
            background: "#FEF3C7",
            border: "1px solid #F59E0B",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#92400E",
            marginBottom: 16,
            textAlign: "center",
          }}>
            📡 You're offline. Connect to the internet to sign in.
          </div>
        )}

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

      {updateInfo.show && (
        <UpdateModal
          onLater={handleUpdateLater}
          onUpdate={handleUpdateNow}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}

export default Login;