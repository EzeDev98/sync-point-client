function AppLogo({ size = 28 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      overflow: "hidden",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <img
        src="/icons/icon-192x192.png"
        alt="SyncPoint"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

export default AppLogo;