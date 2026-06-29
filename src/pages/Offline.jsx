import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNetwork } from "../hooks/useNetwork";
import AppLogo from "../components/AppLogo";

function Offline() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline } = useNetwork();

  // Where to go when internet returns
  const returnTo = location.state?.returnTo || "/login";

  useEffect(() => {
    if (isOnline) {
      navigate(returnTo, { replace: true });
    }
  }, [isOnline, navigate, returnTo]);

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
        textAlign: "center",
      }}>
        <div style={{ marginBottom: 24 }}>
          <AppLogo size={64} />
        </div>

        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>

        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 10,
        }}>
          You're Offline
        </h2>

        <p style={{
          fontSize: 14,
          color: "#6B7280",
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          SyncPoint needs an internet connection to continue.
          Please reconnect and we'll take you right back.
        </p>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "#F8FAFA",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          padding: "12px 20px",
          fontSize: 13,
          color: "#6B7280",
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#DC2626",
            display: "inline-block",
            flexShrink: 0,
          }} />
          Waiting for connection...
        </div>
      </div>
    </div>
  );
}

export default Offline;