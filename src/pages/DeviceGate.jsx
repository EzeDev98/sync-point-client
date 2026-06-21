import { useState } from "react";
import { checkDeviceCompatibility } from "../services/deviceCompatibility";
import "../styles/auth.css";

function DeviceGate({ children }) {
  const [compatInfo] = useState(() => checkDeviceCompatibility());
  const status = compatInfo.isCompatible ? "compatible" : "incompatible";

  if (status === "incompatible") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFFFF",
        padding: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{
          maxWidth: 380,
          width: "100%",
          background: "#F8FAFA",
          border: "1px solid #E5E7EB",
          borderRadius: 14,
          padding: 32,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📵</div>
          <h2 style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 10,
          }}>
            Device Not Supported
          </h2>
          <p style={{
            fontSize: 13.5,
            color: "#6B7280",
            lineHeight: 1.6,
            marginBottom: 20,
          }}>
            {compatInfo?.message}
          </p>
          <div style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 12.5,
            color: "#991B1B",
            lineHeight: 1.5,
            textAlign: "left",
            marginBottom: 20,
          }}>
            <strong>Minimum requirements:</strong>
            <br />• Android 7.0+ (2016 or later)
            <br />• iOS 10+ (2016 or later)
            <br />• Modern browser (Chrome, Safari, Firefox)
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>
            Please update your device or use a more recent phone to access SyncPoint.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default DeviceGate;
