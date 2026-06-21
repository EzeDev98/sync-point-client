import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { saveTransaction, updateTransactionStatus } from "../services/indexedDbService";
import "../styles/auth.css";

function SendMoney() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState("scan");
  const [scannedData, setScannedData] = useState(null);
  const [transactionPayload, setTransactionPayload] = useState(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });

  const html5QrCodeRef = useRef(null);
  const isMountedRef = useRef(true);

  // ── Scanner state machine ────────────────────────────────────────────
  // Root cause of "Cannot clear while scan is ongoing": the previous fix
  // serialized start/stop calls through a promise chain, but only flipped
  // isScannerRunningRef AFTER start() resolved. Under StrictMode's
  // mount -> unmount -> remount cycle, a second start() could be queued
  // and begin executing before the first start()'s promise had settled,
  // because the guard checked a ref that hadn't been updated yet.
  //
  // Fix: scannerStatusRef is set SYNCHRONOUSLY the instant an operation
  // begins, not after it completes. Valid states: 'idle' | 'starting' |
  // 'running' | 'stopping'. Every start/stop call checks this status
  // BEFORE doing anything async, so a second start can never be issued
  // while one is already starting or running on the same instance.
  const scannerStatusRef = useRef("idle");

  // Monotonically increasing generation counter. If a start() call
  // resolves AFTER it has been superseded (screen changed, unmount,
  // a newer start/stop), the stale resolution is recognized as obsolete
  // and discarded rather than mutating state for a no-longer-relevant op.
  const scanGenerationRef = useRef(0);

  const senderWalletId = sessionStorage.getItem("walletId");
  const senderPhone = sessionStorage.getItem("phoneNumber");
  const firstName = sessionStorage.getItem("firstName") || "";
  const lastName = sessionStorage.getItem("lastName") || "";
  const senderName = `${firstName} ${lastName}`.trim() || "User";

  const getOfflineBalance = () =>
    Number(sessionStorage.getItem("offlineBalance") || 0);

  const isSessionValid = Boolean(senderWalletId && senderPhone);

  useEffect(() => {
    if (!isSessionValid) {
      navigate("/login", { replace: true });
    }
  }, [isSessionValid, navigate]);

  /**
   * Fully tear down the Html5Qrcode instance and discard the ref.
   *
   * Fix: rather than reusing a single persisted instance across
   * StrictMode's double-mount (which is what allowed two start() calls
   * to target the same instance), each genuine stop destroys the
   * instance entirely. The next start creates a brand new one. This
   * guarantees there is never more than one start() ever called on any
   * single Html5Qrcode object.
   */
  const destroyScanner = useCallback(async () => {
    const instance = html5QrCodeRef.current;
    html5QrCodeRef.current = null;

    if (!instance) return;

    try {
      // getState() values: 1=NOT_STARTED, 2=SCANNING, 3=PAUSED
      // Only call stop() if it's actually scanning; calling stop() on an
      // instance that never started successfully throws its own error.
      if (typeof instance.getState === "function") {
        const state = instance.getState();
        if (state === 2 || state === 3) {
          await instance.stop();
        }
      } else {
        await instance.stop().catch(() => {});
      }
    } catch (err) {
      console.warn("[SendMoney] destroyScanner stop warning:", err?.message || err);
    }

    try {
      if (typeof instance.clear === "function") {
        instance.clear();
      }
    } catch (err) {
      console.warn("[SendMoney] destroyScanner clear warning:", err?.message || err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      scanGenerationRef.current += 1; // invalidate any in-flight start
      scannerStatusRef.current = "stopping";
      destroyScanner().then(() => {
        scannerStatusRef.current = "idle";
      });
    };
  }, [destroyScanner]);

  const stopScanner = useCallback(async () => {
    if (scannerStatusRef.current === "idle" || scannerStatusRef.current === "stopping") {
      return;
    }

    scanGenerationRef.current += 1; // invalidate any in-flight start
    scannerStatusRef.current = "stopping";

    await destroyScanner();

    scannerStatusRef.current = "idle";
  }, [destroyScanner]);

  const onScanSuccess = useCallback(
    (decodedText) => {
      if (!isMountedRef.current) return;

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

        const offlineBalance = getOfflineBalance();
        if (payload.amount > offlineBalance) {
          setErrorModal({
            show: true,
            message: `Insufficient balance. You have ₦${offlineBalance.toLocaleString()} but need ₦${payload.amount.toLocaleString()}.`,
          });
          return;
        }

        if (payload.amount < 100) {
          setErrorModal({ show: true, message: "Minimum payment amount is ₦100." });
          return;
        }

        if (payload.amount > 1000000) {
          setErrorModal({ show: true, message: "Maximum payment amount is ₦1,000,000." });
          return;
        }

        stopScanner();
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

  /**
   * Start the scanner.
   *
   * Fix: scannerStatusRef is checked and set to 'starting' SYNCHRONOUSLY,
   * before any await. This closes the window that allowed a second call
   * to slip through while the first start() was still pending — the
   * guard no longer depends on a value that's only updated after an
   * async operation resolves.
   *
   * scanGenerationRef lets a stale start() resolution (one superseded by
   * an unmount or a newer start/stop call) recognize it's obsolete and
   * bail out without mutating refs for an operation that's no longer
   * relevant.
   */
  const startScanner = useCallback(async () => {
    if (scannerStatusRef.current === "starting" || scannerStatusRef.current === "running") {
      return;
    }
    if (scannerStatusRef.current === "stopping") {
      return;
    }

    scannerStatusRef.current = "starting";
    const myGeneration = ++scanGenerationRef.current;

    if (!isMountedRef.current) {
      scannerStatusRef.current = "idle";
      return;
    }

    // Always create a fresh instance — never reuse one that may have a
    // start() already pending or completed on it from a prior cycle.
    const instance = new Html5Qrcode("qr-reader");
    html5QrCodeRef.current = instance;

    try {
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        onScanError
      );

      if (myGeneration !== scanGenerationRef.current || !isMountedRef.current) {
        await instance.stop().catch(() => {});
        instance.clear?.();
        return;
      }

      scannerStatusRef.current = "running";
    } catch (err) {
      if (myGeneration !== scanGenerationRef.current || !isMountedRef.current) {
        return;
      }

      const errName = err?.name || "";
      const message = typeof err?.message === "string" ? err.message : "";
      const isKnownNonFatalRace =
        message.includes("already under transition") ||
        message.includes("Cannot clear while scan is ongoing") ||
        message.includes("scanner is already running");

      if (isKnownNonFatalRace) {
        console.warn("[SendMoney] Scanner start raced an internal transition:", message);
        scannerStatusRef.current = "idle";
        return;
      }

      console.error("[SendMoney] Failed to start scanner:", err);
      scannerStatusRef.current = "idle";

      const isPermissionError =
        errName === "NotAllowedError" ||
        errName === "PermissionDeniedError" ||
        errName === "NotFoundError" ||
        errName === "NotReadableError";

      setErrorModal({
        show: true,
        message: isPermissionError
          ? "Unable to access camera. Please check camera permissions."
          : "Camera failed to start. Please try again.",
      });
    }
  }, [onScanSuccess, onScanError]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (screen === "scan" && active && isSessionValid) {
        await startScanner();
      } else {
        await stopScanner();
      }
    };

    init();

    return () => {
      active = false;
      stopScanner();
    };
  }, [screen, startScanner, stopScanner, isSessionValid]);

  function getPageTitle() {
    switch (screen) {
      case "scan":         return "Send Money";
      case "review":       return "Review Payment";
      case "pin":          return "Enter PIN";
      case "confirmation": return "Payment Sent";
      default:             return "Send Money";
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
      case "confirmation":
        navigate("/dashboard");
        break;
    }
  }

  function handleAccept() {
    const storedVerifier = sessionStorage.getItem("pin_verifier");
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

  async function handleSubmit(e) {
    e.preventDefault();

    const storedVerifier = sessionStorage.getItem("pin_verifier");
    const storedSalt = sessionStorage.getItem("pin_salt");

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

      const baseKey = await crypto.subtle.importKey("raw", pinBuffer, "PBKDF2", false, [
        "deriveBits",
      ]);

      const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
        baseKey,
        256
      );

      const inputVerifier = btoa(
        String.fromCharCode(...new Uint8Array(derivedBits))
      );

      if (inputVerifier !== storedVerifier) {
        const attempts =
          parseInt(sessionStorage.getItem("pinAttempts") || "0") + 1;
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

      const balanceBefore = getOfflineBalance();

      const transactionRef = `TXN-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      const createdAt = new Date().toISOString();

      const newBalance = balanceBefore - scannedData.amount;
      sessionStorage.setItem("offlineBalance", newBalance.toString());
      window.dispatchEvent(
        new CustomEvent("balance-updated", { detail: { balance: newBalance } })
      );

      const senderTransaction = {
        type: "TRANSFER",
        transactionRef,
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
        createdAt,
      };

      await saveTransaction(senderTransaction);
      await updateTransactionStatus(transactionRef, "SUCCESS");

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
      setScreen("confirmation");
    } catch (err) {
      console.error("[SendMoney] Payment error:", err);

      const currentBalance = getOfflineBalance();
      const balanceBefore =
        scannedData ? currentBalance + scannedData.amount : currentBalance;
      sessionStorage.setItem("offlineBalance", balanceBefore.toString());
      window.dispatchEvent(
        new CustomEvent("balance-updated", { detail: { balance: balanceBefore } })
      );

      setErrorModal({
        show: true,
        message: err.message || "Payment failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function getInitials(name) {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
      : parts[0][0].toUpperCase();
  }

  if (!isSessionValid) return null;

  const offlineBalance = getOfflineBalance();

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
          <div className="scan-instruction">
            <p className="scan-instruction-text">
              Ask the receiver to open their <strong>Receive</strong> page and
              show you their QR code. Point your camera at it to scan.
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
              <span className="review-value review-ref">
                {scannedData.requestRef}
              </span>
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
            <strong>{scannedData.receiverName}</strong>. This cannot be reversed
            offline.
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
                  ? "Processing..."
                  : `Send ₦${scannedData?.amount?.toLocaleString()}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {screen === "confirmation" && scannedData && transactionPayload && (
        <div className="page-body">
          <div className="confirm-sent-card">
            <div className="confirm-sent-icon">✅</div>
            <div className="confirm-sent-title">Payment Sent!</div>
            <div className="confirm-sent-amount">
              ₦{Number(scannedData.amount).toLocaleString()}
            </div>
            <div className="confirm-sent-to">Sent to</div>
            <div className="confirm-sent-name">{scannedData.receiverName}</div>

            <div className="confirm-sent-divider" />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 0" }}>
              <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center", margin: 0 }}>
                Show this QR to <strong>{scannedData.receiverName}</strong> to confirm receipt
              </p>
              <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                <QRCodeSVG
                  value={JSON.stringify(transactionPayload)}
                  size={160}
                  bgColor="#FFFFFF"
                  fgColor="#111827"
                  level="M"
                />
              </div>
              <p style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", margin: 0 }}>
                Receiver scans this to credit their wallet
              </p>
            </div>

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
            <div className="confirm-sent-row">
              <span className="confirm-sent-row-label">Status</span>
              <span className="confirm-sent-row-value" style={{ color: "#BA7517" }}>
                Pending sync
              </span>
            </div>
          </div>

          <button className="btn-primary" onClick={() => navigate("/dashboard")}>
            Done — Back to Dashboard
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