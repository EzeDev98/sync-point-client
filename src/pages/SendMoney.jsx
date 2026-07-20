import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { saveTransaction, updateTransactionStatus, getPendingCount } from "../services/indexedDbService";
import { getIsOnline } from "../services/networkService";
import { calculateOfflineBalance } from "../services/walletLedger";
import { getCameraPermissionState, watchCameraPermission } from "../services/cameraPermission";
import "../styles/auth.css";

function SendMoney() {
  const navigate = useNavigate();
  // scan -> review -> pin -> showQr -> confirmDetails -> success
  const [screen, setScreen] = useState("scan");
  const [scannedData, setScannedData] = useState(null);
  const [transactionPayload, setTransactionPayload] = useState(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [offlineBalance, setOfflineBalance] = useState(0);
  // "checking" | "granted" | "denied" | "prompt" | "unsupported"
  const [cameraPermission, setCameraPermission] = useState("checking");

  // --- Scanner lifecycle refs: identical pattern to ReceivePayment.jsx ---
  const scannerRef = useRef(null);
  const isScannerRunningRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingTransitionRef = useRef(Promise.resolve());

  const senderWalletId = localStorage.getItem("walletId") || sessionStorage.getItem("walletId");
  const senderPhone = localStorage.getItem("phoneNumber") || sessionStorage.getItem("phoneNumber");
  const firstName = localStorage.getItem("firstName") || sessionStorage.getItem("firstName") || "";
  const lastName = localStorage.getItem("lastName") || sessionStorage.getItem("lastName") || "";
  const senderName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim() || "User";

  const isSessionValid = Boolean(senderWalletId && senderPhone);
  const MAX_OFFLINE_PENDING = 10;

  const offlineBalanceRef = useRef(0);
  useEffect(() => {
    offlineBalanceRef.current = offlineBalance;
  }, [offlineBalance]);

  // Load balance from ledger on mount
  useEffect(() => {
    calculateOfflineBalance()
      .then(setOfflineBalance)
      .catch(() => setOfflineBalance(0));
  }, []);

  useEffect(() => {
    if (!isSessionValid) {
      navigate("/login", { replace: true });
    }
  }, [isSessionValid, navigate]);

  // Mount/unmount tracking + final cleanup — identical to ReceivePayment.jsx
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingTransitionRef.current = pendingTransitionRef.current
        .catch(() => {})
        .then(() => {
          if (scannerRef.current && isScannerRunningRef.current) {
            isScannerRunningRef.current = false;
            return scannerRef.current.stop().catch(() => {});
          }
        });
    };
  }, []);

  // stopScanner — identical pattern to ReceivePayment.jsx
  const stopScanner = useCallback(async () => {
    const operation = pendingTransitionRef.current
      .catch(() => {})
      .then(async () => {
        if (scannerRef.current && isScannerRunningRef.current) {
          isScannerRunningRef.current = false;
          try {
            await scannerRef.current.stop();
          } catch (err) {
            console.warn("[SendMoney] stop() warning:", err?.message || err);
          }
        }
      });

    pendingTransitionRef.current = operation;
    await operation;
  }, []);

  const onScanSuccess = useCallback(
    async (decodedText) => {
      if (!isMountedRef.current) return;

      await stopScanner();

      try {
        const payload = JSON.parse(decodedText);

        if (payload.type !== "PAYMENT_REQUEST") {
          setErrorModal({
            show: true,
            message: "Invalid QR code. Please scan a valid SyncPoint payment request.",
          });
          return;
        }

        if (new Date() > new Date(payload.expiresAt)) {
          setErrorModal({
            show: true,
            message: "This payment request has expired. Ask the receiver to generate a new one.",
          });
          return;
        }

        if (!payload.requestRef || !payload.receiverWalletId || !payload.amount) {
          setErrorModal({
            show: true,
            message: "Invalid payment request — missing required fields.",
          });
          return;
        }

        if (payload.receiverWalletId === senderWalletId) {
          setErrorModal({
            show: true,
            message: "You cannot send money to yourself.",
          });
          return;
        }

        if (!getIsOnline()) {
          const pendingCount = await getPendingCount();
          if (pendingCount >= MAX_OFFLINE_PENDING) {
            setErrorModal({
              show: true,
              message: `You've reached the maximum of ${MAX_OFFLINE_PENDING} pending offline transactions. Please connect to the internet to sync before sending more.`,
            });
            return;
          }
        }

        const currentBalance = offlineBalanceRef.current;

        if (payload.amount > currentBalance) {
          setErrorModal({
            show: true,
            message: `Insufficient balance. You have ₦${currentBalance.toLocaleString()} but need ₦${payload.amount.toLocaleString()}.`,
          });
          return;
        }

        if (payload.amount < 100) {
          setErrorModal({ show: true, message: "Minimum payment amount is ₦100." });
          return;
        }

        if (payload.amount > 20000) {
          setErrorModal({ show: true, message: "Maximum payment amount is ₦20,000." });
          return;
        }

        setScannedData(payload);
        setScreen("review");
      } catch (err) {
        console.error("[SendMoney] QR parse error:", err);
        setErrorModal({
          show: true,
          message: "Could not read QR code. Please try again.",
        });
      }
    },
    [senderWalletId, stopScanner]
  );

  const onScanError = useCallback(() => {}, []);

  // startScanner — identical pattern to ReceivePayment.jsx's startSenderScanner
  const startScanner = useCallback(async () => {
    const operation = pendingTransitionRef.current
      .catch(() => {})
      .then(async () => {
        if (!isMountedRef.current) return;
        if (isScannerRunningRef.current) return;

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader");
        }

        try {
          await scannerRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            onScanError
          );
          if (isMountedRef.current) {
            isScannerRunningRef.current = true;
          } else {
            await scannerRef.current.stop().catch(() => {});
          }
        } catch (err) {
          const isTransitionRace =
            typeof err?.message === "string" &&
            err.message.includes("already under transition");

          if (isTransitionRace) {
            console.warn(
              "[SendMoney] Scanner start raced a pending transition:",
              err.message
            );
            return;
          }

          console.error("[SendMoney] Failed to start scanner:", err);

          if (!isMountedRef.current) return;

          const errName = err?.name || "";
          const errMessage = typeof err?.message === "string" ? err.message : String(err || "");
          const isPermissionError =
            errName === "NotAllowedError" ||
            errName === "PermissionDeniedError" ||
            errName === "NotFoundError" ||
            errName === "NotReadableError" ||
            /permission|denied|not allowed/i.test(errMessage);

          if (isPermissionError) {
            // html5-qrcode's rejection doesn't reliably preserve a usable
            // DOMException.name (it's often just a plain string), so we
            // can't fully trust errName here — but treating any start
            // failure as a permission issue is a safe default given this
            // app only ever runs the scanner behind a camera prompt.
            // Re-derive the real state from the Permissions API where
            // possible so the guard panel (not a dead scan animation)
            // is what the user sees on the next render.
            const state = await getCameraPermissionState();
            setCameraPermission(state === "unsupported" ? "denied" : state);
          }

          setErrorModal({
            show: true,
            message: isPermissionError
              ? "Camera access is blocked. Please allow camera permission for SyncPoint and try again."
              : "Camera failed to start. Please try again.",
          });
        }
      });

    pendingTransitionRef.current = operation;
    await operation;
  }, [onScanSuccess, onScanError]);

  // Check camera permission the moment the scan screen is reached, and
  // keep watching it live — if the user grants access via the browser's
  // site-settings UI while this tab is still open, we pick that up
  // automatically instead of requiring a manual retry.
  useEffect(() => {
    if (!(screen === "scan" && isSessionValid)) return;

    let cancelled = false;
    setCameraPermission("checking");

    getCameraPermissionState().then((state) => {
      if (!cancelled) setCameraPermission(state);
    });

    const unwatch = watchCameraPermission((state) => {
      if (!cancelled) setCameraPermission(state);
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [screen, isSessionValid]);

  // Screen-driven start/stop — scanner only ever runs on the "scan"
  // screen, and only once we know permission isn't already denied (no
  // point starting an animation that can't turn into a live feed).
  useEffect(() => {
    if (screen === "scan" && isSessionValid && cameraPermission !== "denied" && cameraPermission !== "checking") {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [screen, isSessionValid, cameraPermission, startScanner, stopScanner]);

  async function recheckCameraPermission() {
    const state = await getCameraPermissionState();
    setCameraPermission(state);
  }

  function getPageTitle() {
    switch (screen) {
      case "scan":          return "Send Money";
      case "review":        return "Review Payment";
      case "pin":           return "Enter PIN";
      case "showQr":        return "Show QR to Receiver";
      case "confirmDetails":return "Confirm Transaction";
      case "success":       return "Payment Sent";
      default:              return "Send Money";
    }
  }

  function handleBack() {
    switch (screen) {
      case "scan":
        navigate("/dashboard");
        break;
      case "review":
        setScannedData(null);
        setScreen("scan");
        break;
      case "pin":
        setPin("");
        setScreen("review");
        break;
      case "showQr":
        // Nothing has been written to storage yet — safe to go back and re-enter PIN.
        setPin("");
        setScreen("pin");
        break;
      case "confirmDetails":
        setScreen("showQr");
        break;
      case "success":
        // Debit has not happened yet (it only happens on the Done tap below),
        // so it's still safe to step back and re-review.
        setScreen("confirmDetails");
        break;
    }
  }

  function handleAccept() {
    const storedVerifier = localStorage.getItem("pin_verifier");
    if (!storedVerifier) {
      setErrorModal({
        show: true,
        message: "PIN not set up. Please configure your PIN in settings.",
      });
      return;
    }
    setScreen("pin");
  }

  function handleReject() {
    setScannedData(null);
    setScreen("scan");
  }

  function handlePinChange(e) {
    const value = e.target.value;
    if (!/^\d*$/.test(value) || value.length > 4) return;
    setPin(value);
    if (errors.pin) setErrors({});
  }

  // PIN entry only *prepares* the transaction (builds the QR to show the
  // receiver). It does NOT touch storage and does NOT debit anything.
  // The debit only happens later, when the sender explicitly taps
  // "Done — Back to Dashboard" on the final success screen, after both
  // sides have had a chance to confirm the handoff actually happened.
  async function handleSubmit(e) {
    e.preventDefault();

    const storedVerifier = localStorage.getItem("pin_verifier");
    const storedSalt = localStorage.getItem("pin_salt");

    if (!storedVerifier || !storedSalt) {
      setErrorModal({ show: true, message: "Session expired. Please login again." });
      navigate("/login");
      return;
    }

    if (pin.length !== 4) {
      setErrors({ pin: "Please enter your 4-digit PIN." });
      return;
    }

    try {
      const encoder = new TextEncoder();
      const pinBuffer = encoder.encode(pin);
      const salt = Uint8Array.from(atob(storedSalt), (c) => c.charCodeAt(0));

      const baseKey = await crypto.subtle.importKey(
        "raw", pinBuffer, "PBKDF2", false, ["deriveBits"]
      );

      const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
        baseKey,
        256
      );

      const inputVerifier = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));

      if (inputVerifier !== storedVerifier) {
        const attempts = parseInt(sessionStorage.getItem("pinAttempts") || "0") + 1;
        sessionStorage.setItem("pinAttempts", attempts.toString());

        if (attempts >= 3) {
          setErrorModal({
            show: true,
            message: "Too many failed PIN attempts. Please login again.",
          });
          setTimeout(() => {
            sessionStorage.clear();
            navigate("/login");
          }, 2000);
          return;
        }

        setErrors({ pin: "Invalid PIN. Please try again." });
        setPin("");
        return;
      }

      sessionStorage.removeItem("pinAttempts");
      setIsSubmitting(true);

      const transactionRef = `TXN-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const createdAt = new Date().toISOString();

      const qr2Payload = {
        type: "TRANSFER",
        transactionRef,
        requestRef: scannedData.requestRef,
        status: "SUCCESS",
        amount: Number(scannedData.amount),
        currency: scannedData.currency || "NGN",
        description: scannedData.description || null,
        senderWalletId,
        senderPhone,
        senderName,
        receiverWalletId: scannedData.receiverWalletId,
        receiverPhone: scannedData.receiverPhone,
        receiverName: scannedData.receiverName,
        createdAt,
      };

      setTransactionPayload(qr2Payload);
      setScannedData((prev) => ({ ...prev, transactionRef, createdAt }));
      setScreen("showQr");
    } catch (err) {
      console.error("[SendMoney] PIN verification error:", err);
      setErrorModal({
        show: true,
        message: err.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // The ONLY place the debit is actually written to storage — triggered by
  // the sender's own deliberate tap on the final screen.
  async function handleFinalizeDebit() {
    setIsFinalizing(true);
    try {
      const senderTransaction = {
        type: "TRANSFER",
        transactionRef: scannedData.transactionRef,
        requestRef: scannedData.requestRef,
        status: "PENDING",
        amount: Number(scannedData.amount),
        currency: scannedData.currency || "NGN",
        description: scannedData.description || `Payment to ${scannedData.receiverName}`,
        senderWalletId,
        senderPhone,
        senderName,
        receiverWalletId: scannedData.receiverWalletId,
        receiverPhone: scannedData.receiverPhone,
        receiverName: scannedData.receiverName,
        entryType: "DEBIT",
        createdAt: scannedData.createdAt,
      };

      await saveTransaction(senderTransaction);
      await updateTransactionStatus(scannedData.transactionRef, "SUCCESS");

      const newBalance = await calculateOfflineBalance();
      setOfflineBalance(newBalance);
      window.dispatchEvent(
        new CustomEvent("balance-updated", { detail: { balance: newBalance } })
      );

      navigate("/dashboard");
    } catch (err) {
      console.error("[SendMoney] Finalize debit error:", err);
      setErrorModal({
        show: true,
        message: err.message || "Could not complete the debit. Please try again.",
      });
    } finally {
      setIsFinalizing(false);
    }
  }

  function getInitials(name) {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }

  if (!isSessionValid) return null;

  return (
    <div className="sp-app">
      <div className="page-header">
        <button className="back-btn" onClick={handleBack}>
          <ArrowLeft size={16} strokeWidth={1.8} />
        </button>
        <span className="page-title">{getPageTitle()}</span>
      </div>

      {screen === "scan" && (
        <div className="page-body">
          {cameraPermission === "denied" ? (
            <div className="auth-card" style={{ textAlign: "center" }}>
              <div className="modal-icon" style={{ fontSize: 32 }}>🚫</div>
              <h2 className="modal-title" style={{ fontSize: 18 }}>Camera access is blocked</h2>
              <p className="modal-body">
                You previously denied camera permission for SyncPoint, so QR
                scanning can't work until it's allowed again.
              </p>
              <p className="field-hint" style={{ textAlign: "center", marginTop: 8 }}>
                Tap the lock or site-info icon next to the address bar, allow
                Camera access, then come back here — we'll pick it up
                automatically. Otherwise, tap the button below once you've
                changed it.
              </p>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={recheckCameraPermission}>
                I've enabled it — try again
              </button>
            </div>
          ) : cameraPermission === "checking" ? (
            <div className="auth-card" style={{ textAlign: "center", padding: "32px 24px" }}>
              <p style={{ color: "#6B7280", fontSize: 14 }}>Checking camera access...</p>
            </div>
          ) : (
            <>
              <div className="scan-instruction">
                <p className="scan-instruction-text">
                  Ask the receiver to open their <strong>Receive</strong> page
                  and show you their QR code. Point your camera at it to scan.
                </p>
              </div>

              <div className="scanner-wrapper">
                <div className="scanner-box">
                  <div className="scan-corner tl" />
                  <div className="scan-corner tr" />
                  <div className="scan-corner bl" />
                  <div className="scan-corner br" />
                  <div className="scan-line" />
                  <div id="qr-reader" style={{ width: "100%", height: "100%" }} />
                </div>
              </div>

              <p className="scan-hint">Only scan QR codes from people you trust</p>
            </>
          )}
        </div>
      )}

      {screen === "review" && scannedData && (
        <div className="page-body">
          <div className="receiver-card">
            <div className="receiver-avatar">
              {getInitials(scannedData.receiverName)}
            </div>
            <div className="receiver-info">
              <div className="receiver-name">{scannedData.receiverName}</div>
              <div className="receiver-phone">{scannedData.receiverPhone}</div>
            </div>
            <span className="receiver-badge">Verified</span>
          </div>

          <div className="review-card">
            <div className="review-row">
              <span className="review-label">Amount requested</span>
              <span className="review-amount">
                ₦{Number(scannedData.amount).toLocaleString()}
              </span>
            </div>
            <div className="review-divider" />
            {scannedData.description && (
              <div className="review-row">
                <span className="review-label">Description</span>
                <span className="review-value">{scannedData.description}</span>
              </div>
            )}
            <div className="review-row">
              <span className="review-label">Request reference</span>
              <span className="review-value review-ref">{scannedData.requestRef}</span>
            </div>
            <div className="review-divider" />
            <div className="review-row">
              <span className="review-label">Your offline balance</span>
              <span
                className="review-value"
                style={{
                  color: offlineBalance >= scannedData.amount ? "#0F766E" : "#DC2626",
                }}
              >
                ₦{offlineBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="info-banner">
            ℹ️ You are about to send{" "}
            <strong>₦{Number(scannedData.amount).toLocaleString()}</strong> to{" "}
            <strong>{scannedData.receiverName}</strong>. This cannot be reversed offline.
          </div>

          <div className="btn-group">
            <button
              className="btn-primary"
              onClick={handleAccept}
              disabled={offlineBalance < scannedData.amount}
            >
              {offlineBalance < scannedData.amount
                ? "Insufficient Balance"
                : "Accept & Continue"}
            </button>
            <button className="btn-reject" onClick={handleReject}>
              Reject Payment Request
            </button>
          </div>
        </div>
      )}

      {screen === "pin" && (
        <div className="pin-screen-wrapper">
          <div className="pin-screen-inner">
            <div className="pin-screen-header">
              <div className="pin-screen-icon">🔐</div>
              <h2 className="pin-screen-title">Enter your PIN</h2>
              <p className="pin-screen-subtitle">
                Confirm payment of{" "}
                <strong>₦{scannedData?.amount?.toLocaleString()}</strong> to{" "}
                <strong>{scannedData?.receiverName}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <div className="input-wrapper">
                  <input
                    type={showPin ? "text" : "password"}
                    placeholder="• • • •"
                    value={pin}
                    onChange={handlePinChange}
                    inputMode="numeric"
                    maxLength={4}
                    className={errors.pin ? "has-error" : ""}
                    style={{
                      letterSpacing: "0.4em",
                      textAlign: "center",
                      fontSize: 24,
                      height: 56,
                      width: "100%",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPin((p) => !p)}
                    tabIndex={-1}
                    disabled={isSubmitting}
                  >
                    {showPin ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.pin && <p className="field-error">{errors.pin}</p>}
                <p className="field-hint">Enter your 4-digit PIN to confirm</p>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting || pin.length < 4}
                style={{ marginTop: 20 }}
              >
                {isSubmitting
                  ? "Verifying..."
                  : `Continue — Send ₦${scannedData?.amount?.toLocaleString()}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {screen === "showQr" && scannedData && transactionPayload && (
        <div className="page-body">
          <div
            className="info-banner"
            style={{ background: "#FAEEDA", borderColor: "#F6C675", color: "#633806" }}
          >
            ⚠️ <strong>Do not tap the button below until the receiver has actually
            scanned this QR code.</strong> Nothing has been deducted from your
            wallet yet — this only happens after you confirm the handoff on the
            next screens.
          </div>

          <div className="qr-card">
            <span className="qr-label">Show this QR to the receiver</span>
            <div className="qr-amount">
              ₦{Number(scannedData.amount).toLocaleString()}
            </div>

            <div className="qr-box">
              <QRCodeSVG
                value={JSON.stringify(transactionPayload)}
                size={260}
                bgColor="#FFFFFF"
                fgColor="#111827"
                level="M"
              />
            </div>

            <div className="qr-ref">{scannedData.transactionRef}</div>
          </div>

          <div className="btn-group">
            <button className="btn-primary" onClick={() => setScreen("confirmDetails")}>
              Receiver Has Scanned This QR
            </button>
          </div>
        </div>
      )}

      {screen === "confirmDetails" && scannedData && (
        <div className="page-body">
          <div className="info-banner">
            Please check every detail below carefully before confirming.
          </div>

          <div className="confirm-card">
            <div className="confirm-row">
              <span className="confirm-row-label">Sending to</span>
              <span className="confirm-row-value">{scannedData.receiverName}</span>
            </div>
            <div className="confirm-row">
              <span className="confirm-row-label">Receiver phone</span>
              <span className="confirm-row-value">{scannedData.receiverPhone}</span>
            </div>
            <div className="confirm-divider" />
            <div className="confirm-row">
              <span className="confirm-row-label">Amount</span>
              <span className="confirm-row-value">
                ₦{Number(scannedData.amount).toLocaleString()}
              </span>
            </div>
            {scannedData.description && (
              <div className="confirm-row">
                <span className="confirm-row-label">Description</span>
                <span className="confirm-row-value">{scannedData.description}</span>
              </div>
            )}
            <div className="confirm-divider" />
            <div className="confirm-row">
              <span className="confirm-row-label">Sender</span>
              <span className="confirm-row-value">{senderName}</span>
            </div>
            <div className="confirm-row">
              <span className="confirm-row-label">Transaction ref</span>
              <span className="confirm-row-value confirm-row-ref">
                {scannedData.transactionRef}
              </span>
            </div>
            <div className="confirm-row">
              <span className="confirm-row-label">Request ref</span>
              <span className="confirm-row-value confirm-row-ref">
                {scannedData.requestRef}
              </span>
            </div>
          </div>

          <div className="btn-group">
            <button className="btn-primary" onClick={() => setScreen("success")}>
              Confirm Transaction Details
            </button>
          </div>
        </div>
      )}

      {screen === "success" && scannedData && transactionPayload && (
        <div className="centered-screen-wrapper">
          <div className="confirm-sent-card">
            <div className="confirm-sent-icon">✅</div>
            <div className="confirm-sent-title">Ready to Complete</div>
            <div className="confirm-sent-amount">
              ₦{Number(scannedData.amount).toLocaleString()}
            </div>
            <div className="confirm-sent-to">Sending to</div>
            <div className="confirm-sent-name">{scannedData.receiverName}</div>

            <div className="confirm-sent-divider" />

            <div className="confirm-sent-row">
              <span className="confirm-sent-row-label">Transaction ref</span>
              <span className="confirm-sent-row-value" style={{ fontFamily: "monospace", fontSize: 10 }}>
                {scannedData.transactionRef}
              </span>
            </div>
            <div className="confirm-sent-row">
              <span className="confirm-sent-row-label">Request ref</span>
              <span className="confirm-sent-row-value" style={{ fontFamily: "monospace", fontSize: 10 }}>
                {scannedData.requestRef}
              </span>
            </div>
            <div className="confirm-sent-row">
              <span className="confirm-sent-row-label">Date & time</span>
              <span className="confirm-sent-row-value">
                {new Date(scannedData.createdAt).toLocaleString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center", margin: 0 }}>
            Tapping below will mark this transaction as sent.
          </p>

          <button
            className="btn-primary btn-cta-arrow"
            onClick={handleFinalizeDebit}
            disabled={isFinalizing}
          >
            {isFinalizing ? (
              "Processing..."
            ) : (
              <>
                Done, back to Dashboard
                <ArrowRight size={16} className="cta-arrow-nudge" />
              </>
            )}
          </button>
        </div>
      )}

      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Payment Failed</h2>
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

export default SendMoney;







// import { useState, useRef, useEffect, useCallback } from "react";
// import { useNavigate } from "react-router-dom";
// import { ArrowLeft, ArrowRight } from "lucide-react";
// import { Html5Qrcode } from "html5-qrcode";
// import { QRCodeSVG } from "qrcode.react";
// import { saveTransaction, updateTransactionStatus, getPendingCount } from "../services/indexedDbService";
// import { getIsOnline } from "../services/networkService";
// import { calculateOfflineBalance } from "../services/walletLedger";
// import "../styles/auth.css";

// function SendMoney() {
//   const navigate = useNavigate();
//   // scan -> review -> pin -> showQr -> confirmDetails -> success
//   const [screen, setScreen] = useState("scan");
//   const [scannedData, setScannedData] = useState(null);
//   const [transactionPayload, setTransactionPayload] = useState(null);
//   const [pin, setPin] = useState("");
//   const [showPin, setShowPin] = useState(false);
//   const [errors, setErrors] = useState({});
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isFinalizing, setIsFinalizing] = useState(false);
//   const [errorModal, setErrorModal] = useState({ show: false, message: "" });
//   const [offlineBalance, setOfflineBalance] = useState(0);

//   // --- Scanner lifecycle refs: identical pattern to ReceivePayment.jsx ---
//   const scannerRef = useRef(null);
//   const isScannerRunningRef = useRef(false);
//   const isMountedRef = useRef(true);
//   const pendingTransitionRef = useRef(Promise.resolve());

//   const senderWalletId = localStorage.getItem("walletId") || sessionStorage.getItem("walletId");
//   const senderPhone = localStorage.getItem("phoneNumber") || sessionStorage.getItem("phoneNumber");
//   const firstName = localStorage.getItem("firstName") || sessionStorage.getItem("firstName") || "";
//   const lastName = localStorage.getItem("lastName") || sessionStorage.getItem("lastName") || "";
//   const senderName = `${firstName} ${lastName}`.trim() || "User";

//   const isSessionValid = Boolean(senderWalletId && senderPhone);
//   const MAX_OFFLINE_PENDING = 10;

//   const offlineBalanceRef = useRef(0);
//   useEffect(() => {
//     offlineBalanceRef.current = offlineBalance;
//   }, [offlineBalance]);

//   // Load balance from ledger on mount
//   useEffect(() => {
//     calculateOfflineBalance()
//       .then(setOfflineBalance)
//       .catch(() => setOfflineBalance(0));
//   }, []);

//   useEffect(() => {
//     if (!isSessionValid) {
//       navigate("/login", { replace: true });
//     }
//   }, [isSessionValid, navigate]);

//   // Mount/unmount tracking + final cleanup — identical to ReceivePayment.jsx
//   useEffect(() => {
//     isMountedRef.current = true;
//     return () => {
//       isMountedRef.current = false;
//       pendingTransitionRef.current = pendingTransitionRef.current
//         .catch(() => {})
//         .then(() => {
//           if (scannerRef.current && isScannerRunningRef.current) {
//             isScannerRunningRef.current = false;
//             return scannerRef.current.stop().catch(() => {});
//           }
//         });
//     };
//   }, []);

//   // stopScanner — identical pattern to ReceivePayment.jsx
//   const stopScanner = useCallback(async () => {
//     const operation = pendingTransitionRef.current
//       .catch(() => {})
//       .then(async () => {
//         if (scannerRef.current && isScannerRunningRef.current) {
//           isScannerRunningRef.current = false;
//           try {
//             await scannerRef.current.stop();
//           } catch (err) {
//             console.warn("[SendMoney] stop() warning:", err?.message || err);
//           }
//         }
//       });

//     pendingTransitionRef.current = operation;
//     await operation;
//   }, []);

//   const onScanSuccess = useCallback(
//     async (decodedText) => {
//       if (!isMountedRef.current) return;

//       await stopScanner();

//       try {
//         const payload = JSON.parse(decodedText);

//         if (payload.type !== "PAYMENT_REQUEST") {
//           setErrorModal({
//             show: true,
//             message: "Invalid QR code. Please scan a valid SyncPoint payment request.",
//           });
//           return;
//         }

//         if (new Date() > new Date(payload.expiresAt)) {
//           setErrorModal({
//             show: true,
//             message: "This payment request has expired. Ask the receiver to generate a new one.",
//           });
//           return;
//         }

//         if (!payload.requestRef || !payload.receiverWalletId || !payload.amount) {
//           setErrorModal({
//             show: true,
//             message: "Invalid payment request — missing required fields.",
//           });
//           return;
//         }

//         if (payload.receiverWalletId === senderWalletId) {
//           setErrorModal({
//             show: true,
//             message: "You cannot send money to yourself.",
//           });
//           return;
//         }

//         if (!getIsOnline()) {
//           const pendingCount = await getPendingCount();
//           if (pendingCount >= MAX_OFFLINE_PENDING) {
//             setErrorModal({
//               show: true,
//               message: `You've reached the maximum of ${MAX_OFFLINE_PENDING} pending offline transactions. Please connect to the internet to sync before sending more.`,
//             });
//             return;
//           }
//         }

//         const currentBalance = offlineBalanceRef.current;

//         if (payload.amount > currentBalance) {
//           setErrorModal({
//             show: true,
//             message: `Insufficient balance. You have ₦${currentBalance.toLocaleString()} but need ₦${payload.amount.toLocaleString()}.`,
//           });
//           return;
//         }

//         if (payload.amount < 100) {
//           setErrorModal({ show: true, message: "Minimum payment amount is ₦100." });
//           return;
//         }

//         if (payload.amount > 20000) {
//           setErrorModal({ show: true, message: "Maximum payment amount is ₦20,000." });
//           return;
//         }

//         setScannedData(payload);
//         setScreen("review");
//       } catch (err) {
//         console.error("[SendMoney] QR parse error:", err);
//         setErrorModal({
//           show: true,
//           message: "Could not read QR code. Please try again.",
//         });
//       }
//     },
//     [senderWalletId, stopScanner]
//   );

//   const onScanError = useCallback(() => {}, []);

//   // startScanner — identical pattern to ReceivePayment.jsx's startSenderScanner
//   const startScanner = useCallback(async () => {
//     const operation = pendingTransitionRef.current
//       .catch(() => {})
//       .then(async () => {
//         if (!isMountedRef.current) return;
//         if (isScannerRunningRef.current) return;

//         if (!scannerRef.current) {
//           scannerRef.current = new Html5Qrcode("qr-reader");
//         }

//         try {
//           await scannerRef.current.start(
//             { facingMode: "environment" },
//             { fps: 10, qrbox: { width: 250, height: 250 } },
//             onScanSuccess,
//             onScanError
//           );
//           if (isMountedRef.current) {
//             isScannerRunningRef.current = true;
//           } else {
//             await scannerRef.current.stop().catch(() => {});
//           }
//         } catch (err) {
//           const isTransitionRace =
//             typeof err?.message === "string" &&
//             err.message.includes("already under transition");

//           if (isTransitionRace) {
//             console.warn(
//               "[SendMoney] Scanner start raced a pending transition:",
//               err.message
//             );
//             return;
//           }

//           console.error("[SendMoney] Failed to start scanner:", err);

//           if (!isMountedRef.current) return;

//           const errName = err?.name || "";
//           const isPermissionError =
//             errName === "NotAllowedError" ||
//             errName === "PermissionDeniedError" ||
//             errName === "NotFoundError" ||
//             errName === "NotReadableError";

//           setErrorModal({
//             show: true,
//             message: isPermissionError
//               ? "Unable to access camera. Please check camera permissions."
//               : "Camera failed to start. Please try again.",
//           });
//         }
//       });

//     pendingTransitionRef.current = operation;
//     await operation;
//   }, [onScanSuccess, onScanError]);

//   // Screen-driven start/stop — scanner only ever runs on the "scan" screen
//   useEffect(() => {
//     if (screen === "scan" && isSessionValid) {
//       startScanner();
//     } else {
//       stopScanner();
//     }

//     return () => {
//       stopScanner();
//     };
//   }, [screen, isSessionValid, startScanner, stopScanner]);

//   function getPageTitle() {
//     switch (screen) {
//       case "scan":          return "Send Money";
//       case "review":        return "Review Payment";
//       case "pin":           return "Enter PIN";
//       case "showQr":        return "Show QR to Receiver";
//       case "confirmDetails":return "Confirm Transaction";
//       case "success":       return "Payment Sent";
//       default:              return "Send Money";
//     }
//   }

//   function handleBack() {
//     switch (screen) {
//       case "scan":
//         navigate("/dashboard");
//         break;
//       case "review":
//         setScannedData(null);
//         setScreen("scan");
//         break;
//       case "pin":
//         setPin("");
//         setScreen("review");
//         break;
//       case "showQr":
//         // Nothing has been written to storage yet — safe to go back and re-enter PIN.
//         setPin("");
//         setScreen("pin");
//         break;
//       case "confirmDetails":
//         setScreen("showQr");
//         break;
//       case "success":
//         // Debit has not happened yet (it only happens on the Done tap below),
//         // so it's still safe to step back and re-review.
//         setScreen("confirmDetails");
//         break;
//     }
//   }

//   function handleAccept() {
//     const storedVerifier = localStorage.getItem("pin_verifier");
//     if (!storedVerifier) {
//       setErrorModal({
//         show: true,
//         message: "PIN not set up. Please configure your PIN in settings.",
//       });
//       return;
//     }
//     setScreen("pin");
//   }

//   function handleReject() {
//     setScannedData(null);
//     setScreen("scan");
//   }

//   function handlePinChange(e) {
//     const value = e.target.value;
//     if (!/^\d*$/.test(value) || value.length > 4) return;
//     setPin(value);
//     if (errors.pin) setErrors({});
//   }

//   // PIN entry only *prepares* the transaction (builds the QR to show the
//   // receiver). It does NOT touch storage and does NOT debit anything.
//   // The debit only happens later, when the sender explicitly taps
//   // "Done — Back to Dashboard" on the final success screen, after both
//   // sides have had a chance to confirm the handoff actually happened.
//   async function handleSubmit(e) {
//     e.preventDefault();

//     const storedVerifier = localStorage.getItem("pin_verifier");
//     const storedSalt = localStorage.getItem("pin_salt");

//     if (!storedVerifier || !storedSalt) {
//       setErrorModal({ show: true, message: "Session expired. Please login again." });
//       navigate("/login");
//       return;
//     }

//     if (pin.length !== 4) {
//       setErrors({ pin: "Please enter your 4-digit PIN." });
//       return;
//     }

//     try {
//       const encoder = new TextEncoder();
//       const pinBuffer = encoder.encode(pin);
//       const salt = Uint8Array.from(atob(storedSalt), (c) => c.charCodeAt(0));

//       const baseKey = await crypto.subtle.importKey(
//         "raw", pinBuffer, "PBKDF2", false, ["deriveBits"]
//       );

//       const derivedBits = await crypto.subtle.deriveBits(
//         { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
//         baseKey,
//         256
//       );

//       const inputVerifier = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));

//       if (inputVerifier !== storedVerifier) {
//         const attempts = parseInt(sessionStorage.getItem("pinAttempts") || "0") + 1;
//         sessionStorage.setItem("pinAttempts", attempts.toString());

//         if (attempts >= 3) {
//           setErrorModal({
//             show: true,
//             message: "Too many failed PIN attempts. Please login again.",
//           });
//           setTimeout(() => {
//             sessionStorage.clear();
//             navigate("/login");
//           }, 2000);
//           return;
//         }

//         setErrors({ pin: "Invalid PIN. Please try again." });
//         setPin("");
//         return;
//       }

//       sessionStorage.removeItem("pinAttempts");
//       setIsSubmitting(true);

//       const transactionRef = `TXN-${Date.now()}-${Math.random()
//         .toString(36)
//         .substring(2, 8)
//         .toUpperCase()}`;

//       const createdAt = new Date().toISOString();

//       const qr2Payload = {
//         type: "TRANSFER",
//         transactionRef,
//         requestRef: scannedData.requestRef,
//         status: "SUCCESS",
//         amount: Number(scannedData.amount),
//         currency: scannedData.currency || "NGN",
//         description: scannedData.description || null,
//         senderWalletId,
//         senderPhone,
//         senderName,
//         receiverWalletId: scannedData.receiverWalletId,
//         receiverPhone: scannedData.receiverPhone,
//         receiverName: scannedData.receiverName,
//         createdAt,
//       };

//       setTransactionPayload(qr2Payload);
//       setScannedData((prev) => ({ ...prev, transactionRef, createdAt }));
//       setScreen("showQr");
//     } catch (err) {
//       console.error("[SendMoney] PIN verification error:", err);
//       setErrorModal({
//         show: true,
//         message: err.message || "Something went wrong. Please try again.",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   // The ONLY place the debit is actually written to storage — triggered by
//   // the sender's own deliberate tap on the final screen.
//   async function handleFinalizeDebit() {
//     setIsFinalizing(true);
//     try {
//       const senderTransaction = {
//         type: "TRANSFER",
//         transactionRef: scannedData.transactionRef,
//         requestRef: scannedData.requestRef,
//         status: "PENDING",
//         amount: Number(scannedData.amount),
//         currency: scannedData.currency || "NGN",
//         description: scannedData.description || `Payment to ${scannedData.receiverName}`,
//         senderWalletId,
//         senderPhone,
//         senderName,
//         receiverWalletId: scannedData.receiverWalletId,
//         receiverPhone: scannedData.receiverPhone,
//         receiverName: scannedData.receiverName,
//         entryType: "DEBIT",
//         createdAt: scannedData.createdAt,
//       };

//       await saveTransaction(senderTransaction);
//       await updateTransactionStatus(scannedData.transactionRef, "SUCCESS");

//       const newBalance = await calculateOfflineBalance();
//       setOfflineBalance(newBalance);
//       window.dispatchEvent(
//         new CustomEvent("balance-updated", { detail: { balance: newBalance } })
//       );

//       navigate("/dashboard");
//     } catch (err) {
//       console.error("[SendMoney] Finalize debit error:", err);
//       setErrorModal({
//         show: true,
//         message: err.message || "Could not complete the debit. Please try again.",
//       });
//     } finally {
//       setIsFinalizing(false);
//     }
//   }

//   function getInitials(name) {
//     if (!name) return "??";
//     const parts = name.trim().split(" ");
//     return parts.length >= 2
//       ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
//       : parts[0][0].toUpperCase();
//   }

//   if (!isSessionValid) return null;

//   return (
//     <div className="sp-app">
//       <div className="page-header">
//         <button className="back-btn" onClick={handleBack}>
//           <ArrowLeft size={16} strokeWidth={1.8} />
//         </button>
//         <span className="page-title">{getPageTitle()}</span>
//       </div>

//       {screen === "scan" && (
//         <div className="page-body">
//           <div className="scan-instruction">
//             <p className="scan-instruction-text">
//               Ask the receiver to open their <strong>Receive</strong> page and
//               show you their QR code. Point your camera at it to scan.
//             </p>
//           </div>

//           <div className="scanner-wrapper">
//             <div className="scanner-box">
//               <div className="scan-corner tl" />
//               <div className="scan-corner tr" />
//               <div className="scan-corner bl" />
//               <div className="scan-corner br" />
//               <div className="scan-line" />
//               <div id="qr-reader" style={{ width: "100%", height: "100%" }} />
//             </div>
//           </div>

//           <p className="scan-hint">Only scan QR codes from people you trust</p>
//         </div>
//       )}

//       {screen === "review" && scannedData && (
//         <div className="page-body">
//           <div className="receiver-card">
//             <div className="receiver-avatar">
//               {getInitials(scannedData.receiverName)}
//             </div>
//             <div className="receiver-info">
//               <div className="receiver-name">{scannedData.receiverName}</div>
//               <div className="receiver-phone">{scannedData.receiverPhone}</div>
//             </div>
//             <span className="receiver-badge">Verified</span>
//           </div>

//           <div className="review-card">
//             <div className="review-row">
//               <span className="review-label">Amount requested</span>
//               <span className="review-amount">
//                 ₦{Number(scannedData.amount).toLocaleString()}
//               </span>
//             </div>
//             <div className="review-divider" />
//             {scannedData.description && (
//               <div className="review-row">
//                 <span className="review-label">Description</span>
//                 <span className="review-value">{scannedData.description}</span>
//               </div>
//             )}
//             <div className="review-row">
//               <span className="review-label">Request reference</span>
//               <span className="review-value review-ref">{scannedData.requestRef}</span>
//             </div>
//             <div className="review-divider" />
//             <div className="review-row">
//               <span className="review-label">Your offline balance</span>
//               <span
//                 className="review-value"
//                 style={{
//                   color: offlineBalance >= scannedData.amount ? "#0F766E" : "#DC2626",
//                 }}
//               >
//                 ₦{offlineBalance.toLocaleString()}
//               </span>
//             </div>
//           </div>

//           <div className="info-banner">
//             ℹ️ You are about to send{" "}
//             <strong>₦{Number(scannedData.amount).toLocaleString()}</strong> to{" "}
//             <strong>{scannedData.receiverName}</strong>. This cannot be reversed offline.
//           </div>

//           <div className="btn-group">
//             <button
//               className="btn-primary"
//               onClick={handleAccept}
//               disabled={offlineBalance < scannedData.amount}
//             >
//               {offlineBalance < scannedData.amount
//                 ? "Insufficient Balance"
//                 : "Accept & Continue"}
//             </button>
//             <button className="btn-reject" onClick={handleReject}>
//               Reject Payment Request
//             </button>
//           </div>
//         </div>
//       )}

//       {screen === "pin" && (
//         <div className="pin-screen-wrapper">
//           <div className="pin-screen-inner">
//             <div className="pin-screen-header">
//               <div className="pin-screen-icon">🔐</div>
//               <h2 className="pin-screen-title">Enter your PIN</h2>
//               <p className="pin-screen-subtitle">
//                 Confirm payment of{" "}
//                 <strong>₦{scannedData?.amount?.toLocaleString()}</strong> to{" "}
//                 <strong>{scannedData?.receiverName}</strong>
//               </p>
//             </div>

//             <form onSubmit={handleSubmit} noValidate>
//               <div className="form-field">
//                 <div className="input-wrapper">
//                   <input
//                     type={showPin ? "text" : "password"}
//                     placeholder="• • • •"
//                     value={pin}
//                     onChange={handlePinChange}
//                     inputMode="numeric"
//                     maxLength={4}
//                     className={errors.pin ? "has-error" : ""}
//                     style={{
//                       letterSpacing: "0.4em",
//                       textAlign: "center",
//                       fontSize: 24,
//                       height: 56,
//                       width: "100%",
//                       border: "1px solid #E5E7EB",
//                       borderRadius: 8,
//                       outline: "none",
//                       fontFamily: "inherit",
//                     }}
//                     autoFocus
//                     disabled={isSubmitting}
//                   />
//                   <button
//                     type="button"
//                     className="password-toggle"
//                     onClick={() => setShowPin((p) => !p)}
//                     tabIndex={-1}
//                     disabled={isSubmitting}
//                   >
//                     {showPin ? "Hide" : "Show"}
//                   </button>
//                 </div>
//                 {errors.pin && <p className="field-error">{errors.pin}</p>}
//                 <p className="field-hint">Enter your 4-digit PIN to confirm</p>
//               </div>

//               <button
//                 type="submit"
//                 className="btn-primary"
//                 disabled={isSubmitting || pin.length < 4}
//                 style={{ marginTop: 20 }}
//               >
//                 {isSubmitting
//                   ? "Verifying..."
//                   : `Continue — Send ₦${scannedData?.amount?.toLocaleString()}`}
//               </button>
//             </form>
//           </div>
//         </div>
//       )}

//       {screen === "showQr" && scannedData && transactionPayload && (
//         <div className="page-body">
//           <div
//             className="info-banner"
//             style={{ background: "#FAEEDA", borderColor: "#F6C675", color: "#633806" }}
//           >
//             ⚠️ <strong>Do not tap the button below until the receiver has actually
//             scanned this QR code.</strong> Nothing has been deducted from your
//             wallet yet — this only happens after you confirm the handoff on the
//             next screens.
//           </div>

//           <div className="qr-card">
//             <span className="qr-label">Show this QR to the receiver</span>
//             <div className="qr-amount">
//               ₦{Number(scannedData.amount).toLocaleString()}
//             </div>

//             <div className="qr-box">
//               <QRCodeSVG
//                 value={JSON.stringify(transactionPayload)}
//                 size={260}
//                 bgColor="#FFFFFF"
//                 fgColor="#111827"
//                 level="M"
//               />
//             </div>

//             <div className="qr-ref">{scannedData.transactionRef}</div>
//           </div>

//           <div className="btn-group">
//             <button className="btn-primary" onClick={() => setScreen("confirmDetails")}>
//               Receiver Has Scanned This QR
//             </button>
//           </div>
//         </div>
//       )}

//       {screen === "confirmDetails" && scannedData && (
//         <div className="page-body">
//           <div className="info-banner">
//             Please check every detail below carefully before confirming.
//           </div>

//           <div className="confirm-card">
//             <div className="confirm-row">
//               <span className="confirm-row-label">Sending to</span>
//               <span className="confirm-row-value">{scannedData.receiverName}</span>
//             </div>
//             <div className="confirm-row">
//               <span className="confirm-row-label">Receiver phone</span>
//               <span className="confirm-row-value">{scannedData.receiverPhone}</span>
//             </div>
//             <div className="confirm-divider" />
//             <div className="confirm-row">
//               <span className="confirm-row-label">Amount</span>
//               <span className="confirm-row-value">
//                 ₦{Number(scannedData.amount).toLocaleString()}
//               </span>
//             </div>
//             {scannedData.description && (
//               <div className="confirm-row">
//                 <span className="confirm-row-label">Description</span>
//                 <span className="confirm-row-value">{scannedData.description}</span>
//               </div>
//             )}
//             <div className="confirm-divider" />
//             <div className="confirm-row">
//               <span className="confirm-row-label">Sender</span>
//               <span className="confirm-row-value">{senderName}</span>
//             </div>
//             <div className="confirm-row">
//               <span className="confirm-row-label">Transaction ref</span>
//               <span className="confirm-row-value confirm-row-ref">
//                 {scannedData.transactionRef}
//               </span>
//             </div>
//             <div className="confirm-row">
//               <span className="confirm-row-label">Request ref</span>
//               <span className="confirm-row-value confirm-row-ref">
//                 {scannedData.requestRef}
//               </span>
//             </div>
//           </div>

//           <div className="btn-group">
//             <button className="btn-primary" onClick={() => setScreen("success")}>
//               Confirm Transaction Details
//             </button>
//           </div>
//         </div>
//       )}

//       {screen === "success" && scannedData && transactionPayload && (
//         <div className="centered-screen-wrapper">
//           <div className="confirm-sent-card">
//             <div className="confirm-sent-icon">✅</div>
//             <div className="confirm-sent-title">Ready to Complete</div>
//             <div className="confirm-sent-amount">
//               ₦{Number(scannedData.amount).toLocaleString()}
//             </div>
//             <div className="confirm-sent-to">Sending to</div>
//             <div className="confirm-sent-name">{scannedData.receiverName}</div>

//             <div className="confirm-sent-divider" />

//             <div className="confirm-sent-row">
//               <span className="confirm-sent-row-label">Transaction ref</span>
//               <span className="confirm-sent-row-value" style={{ fontFamily: "monospace", fontSize: 10 }}>
//                 {scannedData.transactionRef}
//               </span>
//             </div>
//             <div className="confirm-sent-row">
//               <span className="confirm-sent-row-label">Request ref</span>
//               <span className="confirm-sent-row-value" style={{ fontFamily: "monospace", fontSize: 10 }}>
//                 {scannedData.requestRef}
//               </span>
//             </div>
//             <div className="confirm-sent-row">
//               <span className="confirm-sent-row-label">Date & time</span>
//               <span className="confirm-sent-row-value">
//                 {new Date(scannedData.createdAt).toLocaleString("en-NG", {
//                   day: "numeric",
//                   month: "short",
//                   year: "numeric",
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })}
//               </span>
//             </div>
//           </div>

//           <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center", margin: 0 }}>
//             Tapping below will mark this transaction as sent.
//           </p>

//           <button
//             className="btn-primary btn-cta-arrow"
//             onClick={handleFinalizeDebit}
//             disabled={isFinalizing}
//           >
//             {isFinalizing ? (
//               "Processing..."
//             ) : (
//               <>
//                 Done, back to Dashboard
//                 <ArrowRight size={16} className="cta-arrow-nudge" />
//               </>
//             )}
//           </button>
//         </div>
//       )}

//       {errorModal.show && (
//         <div className="modal-overlay">
//           <div className="modal-card">
//             <div className="modal-icon">⚠️</div>
//             <h2 className="modal-title">Payment Failed</h2>
//             <p className="modal-body">{errorModal.message}</p>
//             <button
//               className="btn-primary"
//               onClick={() => setErrorModal({ show: false, message: "" })}
//             >
//               OK
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default SendMoney;
