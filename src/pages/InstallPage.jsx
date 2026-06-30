import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { isPWAInstalled } from "../services/deviceCompatibility";
import AppLogo from "../components/AppLogo";

// How long to wait for beforeinstallprompt before showing manual instructions
const PROMPT_TIMEOUT_MS = 30_000;

/**
 * InstallPage — waits for the browser's beforeinstallprompt event,
 * then shows a custom install modal. Falls back to manual instructions
 * after PROMPT_TIMEOUT_MS if the event never fires.
 *
 * This page is the ONLY listener for beforeinstallprompt. All previous
 * listeners in main.jsx / InstallService / Welcome must be removed.
 */
function InstallPage() {
  const navigate = useNavigate();

  // "waiting" | "ready" | "installing" | "manual"
  const [phase, setPhase] = useState("waiting");
  const [secondsLeft, setSecondsLeft] = useState(Math.round(PROMPT_TIMEOUT_MS / 1000));
  const [installError, setInstallError] = useState(null);

  const deferredPromptRef = useRef(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    // If already installed, skip everything
    if (isPWAInstalled()) {
      navigate("/welcome", { replace: true });
      return;
    }

    // Listen for the browser's install prompt
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      deferredPromptRef.current = e;
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
      setPhase("ready");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Also listen for appinstalled (e.g. user installs via browser UI)
    function handleAppInstalled() {
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
      setTimeout(() => navigate("/welcome", { replace: true }), 800);
    }

    window.addEventListener("appinstalled", handleAppInstalled);

    // Start countdown timer — fall back to manual after PROMPT_TIMEOUT_MS
    timerRef.current = setTimeout(() => {
      clearInterval(countdownRef.current);
      setPhase("manual");
    }, PROMPT_TIMEOUT_MS);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [navigate]);

  // Poll display-mode changes (catches installs completed via browser UI
  // while this page is visible, including Android mini-infobar taps)
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    function handleChange(e) {
      if (e.matches) navigate("/welcome", { replace: true });
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [navigate]);

  async function handleInstall() {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    setInstallError(null);
    setPhase("installing");

    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferredPromptRef.current = null;

      if (outcome === "accepted") {
        // appinstalled event or display-mode change will redirect
        // Give it a moment in case the event is slow
        setTimeout(() => {
          if (isPWAInstalled()) {
            navigate("/welcome", { replace: true });
          } else {
            // Accepted but not yet showing as installed — show manual just in case
            setPhase("manual");
          }
        }, 2000);
      } else {
        // Declined — prompt is consumed, can't retry in this session
        // Show manual instructions as fallback
        setPhase("manual");
        setInstallError("Installation was cancelled. You can install manually using the instructions below.");
      }
    } catch (err) {
      console.error("[InstallPage] Install error:", err);
      setPhase("manual");
      setInstallError("Something went wrong. Please follow the manual steps below.");
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.brand}>
          <AppLogo size={52} />
          <h1 style={styles.appName}>Install SyncPoint</h1>
        </div>

        {/* ── WAITING ─────────────────────────────────────── */}
        {phase === "waiting" && (
          <div style={styles.waitSection}>
            <div style={styles.spinnerWrap}>
              <div style={styles.spinner} />
            </div>
            <p style={styles.waitTitle}>Preparing installation…</p>
            <p style={styles.waitBody}>
              Getting everything ready. This usually takes just a moment.
            </p>
            <div style={styles.countdown}>
              <div
                style={{
                  ...styles.countdownBar,
                  width: `${(secondsLeft / (PROMPT_TIMEOUT_MS / 1000)) * 100}%`,
                }}
              />
            </div>
            <p style={styles.countdownLabel}>
              {secondsLeft}s remaining
            </p>
          </div>
        )}

        {/* ── READY — custom install modal ────────────────── */}
        {phase === "ready" && (
          <div style={styles.readySection}>
            <div style={styles.readyIcon}>📲</div>
            <p style={styles.readyTitle}>Ready to install</p>
            <p style={styles.readyBody}>
              Install SyncPoint on your device for the full offline payments experience — no browser chrome, works like a native app.
            </p>
            <div style={styles.benefitsList}>
              {[
                "Works offline — send money anywhere",
                "Opens instantly from your home screen",
                "Full-screen, no browser bars",
              ].map((b) => (
                <div key={b} style={styles.benefitItem}>
                  <span style={styles.tick}>✓</span>
                  <span style={styles.benefitText}>{b}</span>
                </div>
              ))}
            </div>
            <button style={styles.installBtn} onClick={handleInstall}>
              Install Now
            </button>
          </div>
        )}

        {/* ── INSTALLING ──────────────────────────────────── */}
        {phase === "installing" && (
          <div style={styles.waitSection}>
            <div style={styles.spinnerWrap}>
              <div style={styles.spinner} />
            </div>
            <p style={styles.waitTitle}>Installing…</p>
            <p style={styles.waitBody}>
              Follow the prompt on your screen to complete the installation.
            </p>
          </div>
        )}

        {/* ── MANUAL INSTRUCTIONS ─────────────────────────── */}
        {phase === "manual" && (
          <div style={styles.manualSection}>
            {installError && (
              <div style={styles.errorBanner}>{installError}</div>
            )}
            <p style={styles.manualTitle}>Install manually</p>
            <p style={styles.manualBody}>
              Follow these steps to add SyncPoint to your home screen:
            </p>

            {/* Android Chrome / Edge */}
            <div style={styles.instructionBlock}>
              <p style={styles.platformLabel}>Android · Chrome or Edge</p>
              {[
                'Tap the ⋮ menu in the top-right corner',
                'Tap "Add to Home Screen" or "Install app"',
                'Tap "Add" or "Install" to confirm',
                'Open SyncPoint from your home screen',
              ].map((step, i) => (
                <div key={i} style={styles.step}>
                  <span style={styles.stepNum}>{i + 1}</span>
                  <span style={styles.stepText}>{step}</span>
                </div>
              ))}
            </div>

            {/* iOS Safari */}
            <div style={styles.instructionBlock}>
              <p style={styles.platformLabel}>iPhone / iPad · Safari</p>
              {[
                'Tap the Share button (square with arrow)',
                'Scroll down and tap "Add to Home Screen"',
                'Tap "Add" in the top-right corner',
                'Open SyncPoint from your home screen',
              ].map((step, i) => (
                <div key={i} style={styles.step}>
                  <span style={styles.stepNum}>{i + 1}</span>
                  <span style={styles.stepText}>{step}</span>
                </div>
              ))}
            </div>

            <p style={styles.manualFooter}>
              After installing, open SyncPoint from your home screen to continue.
            </p>

            {/* Retry button — works if user somehow triggers a new prompt */}
            <button
              style={styles.retryBtn}
              onClick={() => {
                if (deferredPromptRef.current) {
                  setPhase("ready");
                } else {
                  window.location.reload();
                }
              }}
            >
              Try automatic install again
            </button>
          </div>
        )}

      </div>

      {/* Spinner keyframes injected once */}
      <style>{`
        @keyframes sp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
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
    gap: 24,
  },
  brand: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    letterSpacing: "-0.3px",
  },

  // Waiting / Installing
  waitSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
  },
  spinnerWrap: {
    width: 52,
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 44,
    height: 44,
    border: "4px solid #E5E7EB",
    borderTopColor: "#0F766E",
    borderRadius: "50%",
    animation: "sp-spin 0.9s linear infinite",
  },
  waitTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  waitBody: {
    fontSize: 13.5,
    color: "#6B7280",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.5,
  },
  countdown: {
    width: "100%",
    height: 4,
    background: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  countdownBar: {
    height: "100%",
    background: "#0F766E",
    borderRadius: 4,
    transition: "width 1s linear",
  },
  countdownLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    margin: 0,
  },

  // Ready
  readySection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  },
  readyIcon: {
    fontSize: 44,
    lineHeight: 1,
  },
  readyTitle: {
    fontSize: 19,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  readyBody: {
    fontSize: 13.5,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 1.55,
    margin: 0,
  },
  benefitsList: {
    width: "100%",
    background: "#F0FDF9",
    border: "1px solid #99F6E4",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  tick: {
    color: "#0F766E",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  benefitText: {
    fontSize: 13.5,
    color: "#134E4A",
  },
  installBtn: {
    width: "100%",
    padding: "15px",
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

  // Manual
  manualSection: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  errorBanner: {
    background: "#FEF3C7",
    border: "1px solid #F59E0B",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#92400E",
    lineHeight: 1.5,
  },
  manualTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  manualBody: {
    fontSize: 13.5,
    color: "#6B7280",
    margin: 0,
    lineHeight: 1.5,
  },
  instructionBlock: {
    background: "#F8FAFA",
    border: "1px solid #E5E7EB",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  platformLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#0F766E",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    margin: 0,
  },
  step: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  stepNum: {
    width: 20,
    height: 20,
    background: "#0F766E",
    color: "#FFFFFF",
    borderRadius: "50%",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepText: {
    fontSize: 13.5,
    color: "#374151",
    lineHeight: 1.45,
  },
  manualFooter: {
    fontSize: 12.5,
    color: "#9CA3AF",
    textAlign: "center",
    margin: 0,
    lineHeight: 1.5,
  },
  retryBtn: {
    width: "100%",
    padding: "12px",
    background: "none",
    color: "#0F766E",
    border: "1px solid #0F766E",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export default InstallPage;