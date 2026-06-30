function UpdateModal({ onLater, onUpdate, isUpdating }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">⬆️</div>
        <h2 className="modal-title">Update Available</h2>
        <p className="modal-body">
          A newer version of SyncPoint is available. Updating ensures you
          are using the latest features and security improvements.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            className="btn-secondary"
            onClick={onLater}
            disabled={isUpdating}
            style={{ flex: 1 }}
          >
            Later
          </button>
          <button
            className="btn-primary"
            onClick={onUpdate}
            disabled={isUpdating}
            style={{ flex: 1 }}
          >
            {isUpdating ? "Updating..." : "Update Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdateModal;
