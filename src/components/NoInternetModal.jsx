function NoInternetModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">📡</div>
        <h2 className="modal-title">No Internet Connection</h2>
        <p className="modal-body">
          This action requires an internet connection. Please reconnect and try again.
        </p>
        <button className="btn-primary" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

export default NoInternetModal;