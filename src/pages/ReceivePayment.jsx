import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { saveTransaction, updateTransactionStatus, getTransactionByRef } from "../services/indexedDbService";
import { calculateOfflineBalance } from "../services/walletLedger";
import "../styles/auth.css";

function ReceivePayment() {
  const navigate = useNavigate();

  const [screen, setScreen] = useState("form");
  const [formData, setFormData] = useState({ amount: "", description: "" });
  const [errors, setErrors] = useState({});
  const [requestRef, setRequestRef] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const [qrExpired, setQrExpired] = useState(false);
  const timerRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: "" });
  const [createdAt, setCreatedAt] = useState("");

  const scannerRef = useRef(null);
  const isScannerRunningRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingTransitionRef = useRef(Promise.resolve());

  const scanContextRef = useRef({
    formDataDescription: "",
    receiverName: "",
    receiverPhone: "",
  });

  const receiverWalletId = localStorage.getItem("walletId") || sessionStorage.getItem("walletId");
  const receiverPhone = localStorage.getItem("phoneNumber") || sessionStorage.getItem("phoneNumber");
  const firstName = localStorage.getItem("firstName") || sessionStorage.getItem("firstName") || "";
  const lastName = localStorage.getItem("lastName") || sessionStorage.getItem("lastName") || "";
  const receiverName = `${firstName} ${lastName}`.trim() || "User";
  const isSessionValid = !!receiverWalletId && !!receiverPhone;

  useEffect(() => {
    scanContextRef.current = {
      formDataDescription: formData.description,
      receiverName,
      receiverPhone,
    };
  }, [formData.description, receiverName, receiverPhone]);

  useEffect(() => {
    if (!isSessionValid) {
      navigate("/login", { replace: true });
    }
  }, [isSessionValid, navigate]);

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

  const qrPayload = useMemo(() => {
    if (!requestRef) return "";
    return JSON.stringify({
      type: "PAYMENT_REQUEST",
      requestRef,
      receiverWalletId,
      receiverPhone,
      receiverName,
      amount: Number(formData.amount),
      currency: "NGN",
      description: formData.description || null,
      status: "PENDING",
      createdAt,
      expiresAt,
    });
  }, [
    requestRef,
    receiverWalletId,
    receiverPhone,
    receiverName,
    formData.amount,
    formData.description,
    createdAt,
    expiresAt,
  ]);

  useEffect(() => {
    if (screen !== "qr") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setQrExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [screen]);

  const stopScanner = useCallback(async () => {
    const operation = pendingTransitionRef.current
      .catch(() => {})
      .then(async () => {
        if (scannerRef.current && isScannerRunningRef.current) {
          isScannerRunningRef.current = false;
          try {
            await scannerRef.current.stop();
          } catch (err) {
            console.warn("[ReceivePayment] stop() warning:", err?.message || err);
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
      setIsProcessing(true);

      try {
        let senderPayload;
        try {
          senderPayload = JSON.parse(decodedText);
        } catch {
          throw new Error("Invalid QR code format. Please scan a valid transaction QR.");
        }

        if (senderPayload.type !== "TRANSFER") {
          throw new Error(
            "Invalid QR code. Please scan the sender's transaction receipt QR."
          );
        }

        if (senderPayload.requestRef !== requestRef) {
          throw new Error(
            "Payment request mismatch. This QR does not match your current request."
          );
        }
        if (senderPayload.receiverWalletId !== receiverWalletId) {
          throw new Error("This payment is intended for a different wallet.");
        }
        if (Number(senderPayload.amount) !== Number(formData.amount)) {
          throw new Error(
            `Amount mismatch. Expected ₦${Number(formData.amount).toLocaleString()} but received ₦${Number(senderPayload.amount).toLocaleString()}.`
          );
        }
        if (new Date() > new Date(expiresAt)) {
          throw new Error(
            "Payment request has expired. Please generate a new QR code."
          );
        }
        if (senderPayload.status !== "SUCCESS") {
          throw new Error(
            "Payment is not confirmed. Ask the sender to complete the payment."
          );
        }

        const existing = await getTransactionByRef(senderPayload.transactionRef);
        if (existing) {
          throw new Error("This transaction has already been processed.");
        }

        const { formDataDescription, receiverName: rxName, receiverPhone: rxPhone } =
          scanContextRef.current;

        await saveTransaction({
          type: "TRANSFER",
          transactionRef: senderPayload.transactionRef,
          requestRef,
          status: "PENDING",
          amount: Number(senderPayload.amount),
          currency: senderPayload.currency || "NGN",
          description: senderPayload.description || formDataDescription || null,
          senderWalletId: senderPayload.senderWalletId,
          senderPhone: senderPayload.senderPhone,
          senderName: senderPayload.senderName,
          receiverWalletId,
          receiverPhone: rxPhone,
          receiverName: rxName,
          entryType: "CREDIT",
          createdAt: senderPayload.createdAt || new Date().toISOString(),
        });

        await updateTransactionStatus(senderPayload.transactionRef, "SUCCESS");

        // Recalculate balance from ledger — no manual arithmetic
        const newBalance = await calculateOfflineBalance();
        window.dispatchEvent(
          new CustomEvent("balance-updated", { detail: { balance: newBalance } })
        );

        setScreen("success");
      } catch (err) {
        console.error("[ReceivePayment] Confirmation error:", err);
        setErrorModal({
          show: true,
          message: err.message || "Failed to confirm payment. Please try again.",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [requestRef, receiverWalletId, formData.amount, expiresAt, stopScanner]
  );

  const onScanError = useCallback(() => {}, []);

  const startSenderScanner = useCallback(async () => {
    const operation = pendingTransitionRef.current
      .catch(() => {})
      .then(async () => {
        if (!isMountedRef.current) return;
        if (isScannerRunningRef.current) return;

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("sender-qr-reader");
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
              "[ReceivePayment] Scanner start raced a pending transition:",
              err.message
            );
            return;
          }

          console.error("[ReceivePayment] Failed to start scanner:", err);

          if (!isMountedRef.current) return;

          const errName = err?.name || "";
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
      });

    pendingTransitionRef.current = operation;
    await operation;
  }, [onScanSuccess, onScanError]);

  useEffect(() => {
    if (screen === "confirm") {
      startSenderScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [screen, startSenderScanner, stopScanner]);

  function formatTime(seconds) {
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const second = String(seconds % 60).padStart(2, "0");
    return `${minutes}:${second}`;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate() {
    const newErrors = {};
    const amount = Number(formData.amount);
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      newErrors.amount = "Enter a valid amount";
    } else if (amount < 100) {
      newErrors.amount = "Minimum amount is ₦100";
    } else if (amount > 1000000) {
      newErrors.amount = "Maximum amount is ₦1,000,000";
    }
    return newErrors;
  }

  function handleGenerate(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date().toISOString();

    setRequestRef(`REQ-${date}-${random}`);
    setCreatedAt(now);                 // frozen at generation time
    setExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
    setTimeLeft(300);
    setQrExpired(false);
    setScreen("qr");
  }

  function getPageTitle() {
    switch (screen) {
      case "form":    return "Receive Payment";
      case "qr":      return "Payment QR Code";
      case "confirm": return "Scan Sender QR";
      case "success": return "Payment Received";
      default:        return "Receive Payment";
    }
  }

  function handleBack() {
    switch (screen) {
      case "form":
        navigate("/dashboard");
        break;
      case "qr":
        setScreen("form");
        break;
      case "confirm":
        setScreen("qr");
        break;
      case "success":
        navigate("/dashboard");
        break;
    }
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

      {screen === "form" && (
        <div className="form-screen-wrapper">
          <div className="form-screen-inner">
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 6 }}>
                Receive Payment
              </h2>
              <p style={{ fontSize: 13, color: "#6B7280" }}>
                Enter the amount and generate a QR code for the sender to scan.
              </p>
            </div>

            <form className="form-section" onSubmit={handleGenerate} noValidate>
              <div className="form-field">
                <label htmlFor="amount">Amount to receive</label>
                <div className="amount-wrapper">
                  <span className="currency-symbol">₦</span>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    className={`amount-input ${errors.amount ? "has-error" : ""}`}
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleChange}
                    min="0"
                    step="100"
                    required
                  />
                </div>
                {errors.amount ? (
                  <p className="field-error">{errors.amount}</p>
                ) : (
                  <p className="field-hint">Minimum ₦100 · Maximum ₦1,000,000</p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="description">
                  Description{" "}
                  <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  placeholder="e.g. Payment for goods"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={100}
                />
              </div>

              <button type="submit" className="btn-primary">
                Generate Payment QR
              </button>
            </form>
          </div>
        </div>
      )}

      {screen === "qr" && (
        <div className="page-body">
          <div className="qr-card">
            <span className="qr-label">Show this QR to the sender</span>
            <div className="qr-amount">
              ₦{Number(formData.amount).toLocaleString()}
            </div>

            <div className="qr-box">
              {qrExpired ? (
                <div className="qr-expired-msg">
                  <span>❌</span>
                  <p>QR Expired</p>
                </div>
              ) : (
                <QRCodeSVG
                  value={qrPayload}
                  size={320}
                  bgColor="#FFFFFF"
                  fgColor="#111827"
                  level="M"
                />
              )}
            </div>

            {formData.description && (
              <div className="qr-desc">{formData.description}</div>
            )}

            <div className="qr-ref">{requestRef}</div>

            <div className={`qr-expiry ${qrExpired ? "expired" : ""}`}>
              {qrExpired
                ? "❌ QR Expired — Generate a new one"
                : `⏱ Expires in ${formatTime(timeLeft)}`}
            </div>
          </div>

          <div className="info-banner">
            📱 Show this QR to the sender. Once they pay, tap{" "}
            <strong>"I've Received Payment"</strong> — your camera will open
            to scan their confirmation QR.
          </div>

          <div className="btn-group">
            {qrExpired ? (
              <button className="btn-primary" onClick={() => setScreen("form")}>
                Generate New QR
              </button>
            ) : (
              <>
                <button
                  className="btn-primary"
                  onClick={() => setScreen("confirm")}
                  disabled={isProcessing}
                >
                  I've Received Payment
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setScreen("form")}
                >
                  Generate New QR
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {screen === "confirm" && (
        <div className="page-body">
          <div className="scan-instruction">
            <p className="scan-instruction-text">
              Ask the sender to show their <strong>Payment Sent</strong> screen.
              Point your camera at the QR code on their device.
            </p>
          </div>

          <div className="scanner-wrapper">
            <div className="scanner-box">
              <div className="scan-corner tl" />
              <div className="scan-corner tr" />
              <div className="scan-corner bl" />
              <div className="scan-corner br" />
              <div className="scan-line" />
              <div id="sender-qr-reader" style={{ width: "100%", height: "100%" }} />
            </div>
          </div>

          {isProcessing && (
            <div className="info-banner">⏳ Verifying payment...</div>
          )}

          <div
            className="info-banner"
            style={{ background: "#FAEEDA", borderColor: "#F6C675", color: "#633806" }}
          >
            ⚠️ Only scan a QR shown live on the sender's device. Do not scan screenshots.
          </div>

          <div className="btn-group">
            <button
              className="btn-secondary"
              onClick={() => setScreen("qr")}
              disabled={isProcessing}
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {screen === "success" && (
        <div className="success-screen">
          <div className="success-icon">🎉</div>
          <div className="success-title">Payment Received!</div>
          <div className="success-amount">
            ₦{Number(formData.amount).toLocaleString()}
          </div>
          <div className="success-desc">
            Your offline wallet has been credited.
            <br />
            This transaction will sync when you're back online.
          </div>
          <button
            className="btn-primary"
            style={{ maxWidth: 300 }}
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {errorModal.show && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h2 className="modal-title">Payment Confirmation Failed</h2>
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

export default ReceivePayment;