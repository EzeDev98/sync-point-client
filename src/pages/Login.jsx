import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, checkPinSet } from "../services/api";
import { persistValue, hasResumableSession } from "../services/sessionUtils";
import { restoreQuarantineIfPresent } from "../services/quarantineService";
import { refreshOnStartup } from "../services/token";
import { useNetwork } from "../hooks/useNetwork";
import UpdateModal from "../components/UpdateModal";
import { checkForUpdate } from "../services/versionService";
import { performHardReset } from "../services/hardReset";
import "../styles/login.css";
import { getIsOnline } from "../services/networkService";

const MANDATORY_POLL_MS = 15_000;

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
    rememberMe: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSessionModal, setActiveSessionModal] = useState(false);
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);

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

  // Aggressive, unavoidable update check while on the login screen — this
  // is the only place an update can safely be applied, since a fresh
  // login here is guaranteed to have zero pending transactions. Polls
  // every 15s and re-checks immediately whenever the tab regains focus,
  // so a connection that comes back mid-visit is caught right away
  // without needing a manual refresh.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!getIsOnline()) return;
      try {
        const { updateAvailable, remoteBuildId } = await checkForUpdate();
        if (!cancelled && updateAvailable) {
          setUpdateInfo({ show: true, remoteBuildId });
        }
      } catch (err) {
        console.warn("[Login] Mandatory update check failed:", err);
      }
    }

    const intervalId = setInterval(poll, MANDATORY_POLL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  async function handleUpdateNow() {
    setIsUpdating(true);
    try {
      await performHardReset();
    } catch (err) {
      console.error("[Login] Hard reset failed:", err);
      setIsUpdating(false);
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

      sessionStorage.setItem("sessionToken", data.token);
      sessionStorage.setItem("accessTokenExpiresIn", data.accessTokenExpiresIn);

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

      const hadQuarantinedData = await restoreQuarantineIfPresent(data.wallet_id);
      if (hadQuarantinedData) {
        sessionStorage.setItem("pendingQuarantineSync", "true");
      }

      const pinSet = await checkPinSet(data.wallet_id);
      if (pinSet === false) {
        setShowPinModal(true);
      } else {
        navigate("/verifypin");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.status === 409) {
        setActiveSessionModal(true);
      } else {
        setErrorModal({
          show: true,
          message: err.message || "Something went wrong. Please try again.",
        });
      }
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

  // Mandatory update block — nothing else on this page renders. No "Later"
  // path exists: the only way past this screen is to update.
  if (updateInfo.show) {
    return (
      <div className="auth-page">
        <UpdateModal
          onUpdate={handleUpdateNow}
          isUpdating={isUpdating}
          mandatory
        />
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
              <button
                type="button"
                className="auth-link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password?
              </button>
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

      {forgotPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">🛠️</div>
            <h2 className="modal-title">Not available yet</h2>
            <p className="modal-body">
              Password reset isn't set up yet. For now, please reach out to
              support for help getting back into your account.
            </p>
            <button className="btn-primary" onClick={() => setForgotPasswordModal(false)}>
              OK
            </button>
          </div>
        </div>
      )}

      {activeSessionModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">🔒</div>
            <h2 className="modal-title">Already signed in elsewhere</h2>
            <p className="modal-body">
              This account is currently active on another device. To protect your
              transaction data, please unlock your wallet on that device and log
              out properly before signing in here.
            </p>
            <button className="btn-primary" onClick={() => setActiveSessionModal(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;