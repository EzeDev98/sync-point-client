function UpdateModal({ onLater, onUpdate, isUpdating, mandatory = false }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">⬆️</div>
        <h2 className="modal-title">
          {mandatory ? "Update Required" : "Update Available"}
        </h2>
        <p className="modal-body">
          {mandatory
            ? "A required update is ready. Please update now to continue signing in. If you have another device signed in, make sure it has synced before updating."
            : "A newer version of SyncPoint is available. Updating ensures you are using the latest features and security improvements."}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {!mandatory && (
            <button
              className="btn-secondary"
              onClick={onLater}
              disabled={isUpdating}
              style={{ flex: 1 }}
            >
              Later
            </button>
          )}
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