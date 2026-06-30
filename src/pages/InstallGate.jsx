import { useState, useEffect, useCallback } from "react";
import { isPWAInstalled } from "../services/deviceCompatibility";
import AppLogo from "../components/AppLogo";

function detectPlatform() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  return { isIOS };
}

function InstallGate({ children }) {
  const [installed, setInstalled] = useState(() => isPWAInstalled());
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__deferredInstallPrompt ?? null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [promptTimedOut, setPromptTimedOut] = useState(false);

  const { isIOS } = detectPlatform();

  useEffect(() => {
    if (installed) return;

    function handleBeforeInstall(e) {
      e.preventDefault();
      window.__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    }

    function handleAppInstalled() {
      window.__deferredInstallPrompt = null;
      setDeferredPrompt(null);
      setInstalled(true);
    }

    // Catches installs done via the browser's own native install icon
    // (e.g. Chrome's omnibox install button) instead of our button —
    // re-check standalone mode whenever the tab regains focus.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isPWAInstalled()) {
        setInstalled(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // If beforeinstallprompt hasn't fired within a few seconds, either the
    // browser doesn't support it at all (Safari/Firefox), or Chrome's own
    // engagement heuristics decided not to fire it yet. Either way, stop
    // showing "Preparing…" and fall back to manual instructions.
    const timeoutId = setTimeout(() => setPromptTimedOut(true), 8000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, [installed]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      window.__deferredInstallPrompt = null;
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        setTimeout(() => {
          if (isPWAInstalled()) setInstalled(true);
        }, 1000);
      }
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  if (installed) {
    return children;
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#FFFFFF",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      textAlign: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <AppLogo size={72} />
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginTop: 20, marginBottom: 10 }}>
        Install SyncPoint to Continue
      </h1>
      <p style={{ fontSize: 14.5, color: "#6B7280", lineHeight: 1.6, maxWidth: 320, marginBottom: 28 }}>
        SyncPoint is an offline-first app. Installing it to your device is required
        before you can sign in or create an account.
      </p>

      {isIOS ? (
        <div style={{
          background: "#F8FAFA",
          border: "1px solid #E5E7EB",
          borderRadius: 14,
          padding: "20px 22px",
          maxWidth: 340,
          textAlign: "left",
        }}>
          <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.8, margin: 0 }}>
            1. Tap the <strong>Share</strong> icon in Safari's toolbar<br />
            2. Scroll down and tap <strong>"Add to Home Screen"</strong><br />
            3. Tap <strong>"Add"</strong><br />
            4. Open SyncPoint from your Home Screen to continue
          </p>
        </div>
      ) : deferredPrompt ? (
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "14px",
            background: "#0F766E",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: isInstalling ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: isInstalling ? 0.7 : 1,
          }}
        >
          {isInstalling ? "Installing..." : "📲 Install App"}
        </button>
      ) : promptTimedOut ? (
        <div style={{
          background: "#FEF3C7",
          border: "1px solid #F59E0B",
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: 13,
          color: "#92400E",
          maxWidth: 320,
          lineHeight: 1.6,
        }}>
          Your browser doesn't support automatic installation here. Look for an
          "Install app" or "Add to Home Screen" option in your browser's menu,
          then reopen SyncPoint from your home screen.
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>Preparing install…</p>
      )}
    </div>
  );
}

export default InstallGate;