// Dialog shown when an action needs a connection.
import Button from '../../ui/Button/Button.jsx';
import Modal from '../../ui/Modal/Modal.jsx';

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
