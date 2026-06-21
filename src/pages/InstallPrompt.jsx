import { useState, useEffect } from "react";
import { isPWAInstalled } from "../services/deviceCompatibility";

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (isPWAInstalled()) return;

    const wasDismissed = sessionStorage.getItem("pwa_prompt_dismissed");
    if (wasDismissed) return;

    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setShowPrompt(false);
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      console.log("[InstallPrompt] PWA installed");
    } else {
      console.log("[InstallPrompt] PWA install declined");
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  }

  if (!showPrompt) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 32px)",
      maxWidth: 400,
      background: "#FFFFFF",
      border: "1px solid #E5E7EB",
      borderRadius: 14,
      padding: "16px 18px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      gap: 14,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Logo */}
      <div style={{
        width: 44,
        height: 44,
        background: "#0F766E",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: 20,
      }}>
        💳
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>
          Install SyncPoint
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
          Add to home screen for offline payments
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "#6B7280",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Later
        </button>
        <button
          onClick={handleInstall}
          style={{
            background: "#0F766E",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
