import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasResumableSession } from "../services/sessionUtils";
import { isPWAInstalled } from "../services/deviceCompatibility";
import AppLogo from "../components/AppLogo";

function Welcome() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(
    () => window.__deferredInstallPrompt ?? null
  );

  useEffect(() => {
    // If the user already has a session, skip Welcome entirely
    if (hasResumableSession()) {
      navigate("/login", { replace: true });
      return;
    }

    function handleBeforeInstall(e) {
      e.preventDefault();
      window.__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [navigate]);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    window.__deferredInstallPrompt = null;
    setDeferredPrompt(null);
    console.log("[Welcome] PWA install outcome:", outcome);
  }

  const showInstallButton = !isPWAInstalled() && !!deferredPrompt;

  return (
    <div style={{
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
    }}>
      {/* Branding */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <AppLogo size={80} />
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#111827",
          marginTop: 16,
          marginBottom: 8,
          letterSpacing: "-0.5px",
        }}>
          SyncPoint
        </h1>
        <p style={{
          fontSize: 15,
          color: "#6B7280",
          lineHeight: 1.6,
          maxWidth: 280,
          margin: "0 auto",
        }}>
          Offline-first peer-to-peer payments. Send and receive money without internet.
        </p>
      </div>

      {/* Feature highlights */}
      <div style={{
        width: "100%",
        background: "#F8FAFA",
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        padding: "20px 24px",
        marginBottom: 32,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        {[
          { icon: "📶", text: "Works completely offline" },
          { icon: "🔐", text: "End-to-end encrypted transactions" },
          { icon: "⚡", text: "Instant QR-based payments" },
          { icon: "🔄", text: "Auto-syncs when you reconnect" },
        ].map(({ icon, text }) => (
          <div key={text} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
            color: "#374151",
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            {text}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {showInstallButton && (
          <button
            onClick={handleInstall}
            style={{
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            📲 Install App
          </button>
        )}

        <button
          onClick={() => navigate("/login")}
          style={{
            width: "100%",
            padding: "14px",
            background: showInstallButton ? "#F8FAFA" : "#0F766E",
            color: showInstallButton ? "#111827" : "#FFFFFF",
            border: showInstallButton ? "1px solid #E5E7EB" : "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Sign In
        </button>

        <button
          onClick={() => navigate("/register")}
          style={{
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
          }}
        >
          Create Account
        </button>
      </div>

      <p style={{
        marginTop: 24,
        fontSize: 11.5,
        color: "#9CA3AF",
        textAlign: "center",
      }}>
        By continuing you agree to our Terms of Service
      </p>
    </div>
  );
}

export default Welcome;