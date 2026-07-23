import Button from '../../ui/Button/Button.jsx';
import Modal from '../../ui/Modal/Modal.jsx';

/**
 * Shown when an action needs connectivity that is not available.
 * Now composed from Modal and Button instead of re-declaring the dialog
 * markup and .btn-primary by hand.
 */
function NoInternetModal({ show, onClose }) {
  return (
    <Modal
      open={show}
      icon="📡"
      title="No internet connection"
      onClose={onClose}
      actions={<Button onClick={onClose}>OK</Button>}
    >
      This action needs an internet connection. Reconnect and try again.
    </Modal>
  );
}

export default NoInternetModal;