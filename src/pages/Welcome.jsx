import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hasResumableSession } from "../services/sessionUtils";
import AppLogo from "../components/AppLogo";

/**
 * Welcome - Welcome screen with features and navigation
 * 
 * This component no longer handles installation logic.
 * Installation is guaranteed by InstallGuard.
 */
function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    // If the user already has a session, skip Welcome entirely
    if (hasResumableSession()) {
      navigate("/login", { replace: true });
      return;
    }
  }, [navigate]);

  return (
    <div style={styles.container}>
      {/* Branding */}
      <div style={styles.branding}>
        <AppLogo size={80} />
        <h1 style={styles.title}>SyncPoint</h1>
        <p style={styles.description}>
          Offline-first peer-to-peer payments. Send and receive money without internet.
        </p>
      </div>

      {/* Feature highlights */}
      <div style={styles.features}>
        {[
          { icon: "📶", text: "Works completely offline" },
          { icon: "🔐", text: "End-to-end encrypted transactions" },
          { icon: "⚡", text: "Instant QR-based payments" },
          { icon: "🔄", text: "Auto-syncs when you reconnect" },
        ].map(({ icon, text }) => (
          <div key={text} style={styles.featureItem}>
            <span style={styles.featureIcon}>{icon}</span>
            {text}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={styles.actions}>
        <button
          onClick={() => navigate("/login")}
          style={styles.loginButton}
        >
          Sign In
        </button>

        <button
          onClick={() => navigate("/register")}
          style={styles.registerButton}
        >
          Create Account
        </button>
      </div>

      <p style={styles.terms}>
        By continuing you agree to our Terms of Service
      </p>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#FFFFFF",
    padding: "40px 24px",
    maxWidth: 480,
    margin: "0 auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  branding: {
    marginBottom: 32,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  description: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 1.6,
    maxWidth: 280,
    margin: "0 auto",
  },
  features: {
    width: "100%",
    background: "#F8FAFA",
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: "20px 24px",
    marginBottom: 32,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 14,
    color: "#374151",
  },
  featureIcon: {
    fontSize: 18,
  },
  actions: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  loginButton: {
    width: "100%",
    padding: "14px",
    background: "#0F766E",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  registerButton: {
    width: "100%",
    padding: "14px",
    background: "none",
    color: "#0F766E",
    border: "1px solid #0F766E",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  terms: {
    marginTop: 24,
    fontSize: 11.5,
    color: "#9CA3AF",
    textAlign: "center",
  },
};

export default Welcome;