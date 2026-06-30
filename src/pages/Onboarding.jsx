import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isPWAInstalled } from "../services/deviceCompatibility";
import AppLogo from "../components/AppLogo";

/**
 * Onboarding — the very first screen at /
 *
 * Users who haven't installed the app land here.
 * Already-installed users are sent straight to /welcome.
 */
function Onboarding() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isPWAInstalled()) {
      navigate("/welcome", { replace: true });
    }
  }, [navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo + brand */}
        <div style={styles.brand}>
          <AppLogo size={64} />
          <h1 style={styles.appName}>SyncPoint</h1>
          <p style={styles.tagline}>
            Send and receive money even without internet.
          </p>
        </div>

        {/* Feature list */}
        <div style={styles.features}>
          {[
            { icon: "📶", heading: "Works fully offline", body: "Complete transactions without a network connection using encrypted QR codes." },
            { icon: "🔐", heading: "End-to-end encrypted", body: "Every transaction is encrypted with a key only you control — your PIN." },
            { icon: "⚡", heading: "Instant QR payments", body: "Scan to pay or receive in seconds. No account numbers, no delays." },
            { icon: "🔄", heading: "Syncs when reconnected", body: "Transactions recorded offline automatically sync to the server once you're back online." },
          ].map(({ icon, heading, body }) => (
            <div key={heading} style={styles.featureRow}>
              <span style={styles.featureIcon}>{icon}</span>
              <div>
                <p style={styles.featureHeading}>{heading}</p>
                <p style={styles.featureBody}>{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={styles.cta}>
          <p style={styles.ctaHint}>
            SyncPoint works as an installed app for the full offline experience.
          </p>
          <button
            style={styles.nextBtn}
            onClick={() => navigate("/install")}
          >
            Get Started →
          </button>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8FAFA",
    padding: "24px 16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "36px 28px 32px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: 28,
  },
  brand: {
    textAlign: "center",
  },
  appName: {
    fontSize: 26,
    fontWeight: 700,
    color: "#111827",
    margin: "12px 0 6px",
    letterSpacing: "-0.4px",
  },
  tagline: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 1.5,
    margin: 0,
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: "#F8FAFA",
    borderRadius: 12,
    padding: "18px 16px",
    border: "1px solid #E5E7EB",
  },
  featureRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    flexShrink: 0,
    marginTop: 1,
  },
  featureHeading: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 2px",
  },
  featureBody: {
    fontSize: 12.5,
    color: "#6B7280",
    margin: 0,
    lineHeight: 1.5,
  },
  cta: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  ctaHint: {
    fontSize: 12.5,
    color: "#9CA3AF",
    textAlign: "center",
    margin: 0,
    lineHeight: 1.5,
  },
  nextBtn: {
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
    letterSpacing: "0.1px",
  },
};

export default Onboarding;