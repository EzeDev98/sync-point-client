// Dialog prompting the user to load a newer build.
import Button from '../../ui/Button/Button.jsx';
import Modal from '../../ui/Modal/Modal.jsx';

function UpdateModal({ onLater, onUpdate, isUpdating, error = '', mandatory = false }) {
  return (
    <Modal
      open
      icon="⬆️"
      title={mandatory ? 'Update required' : 'Update available'}
      onClose={mandatory ? undefined : onLater}
      dismissOnOverlayClick={!mandatory}
      dismissOnEscape={!mandatory}
      actions={
        <>
          {!mandatory && (
            <Button variant="secondary" onClick={onLater} disabled={isUpdating}>
              Later
            </Button>
          )}
          <Button onClick={onUpdate} loading={isUpdating} loadingLabel="Updating...">
            Update now
          </Button>
        </>
      }
    >
      {mandatory
        ? 'A required update is ready. Update now to continue signing in. If you have another device signed in, make sure it has synced first.'
        : 'A newer version of SyncPoint is available. Updating keeps you on the latest features and security improvements.'}
      {error && (
        <span role="alert">
          <br />
          <br />
          {error}
        </span>
      )}
    </Modal>
  );
}

export default UpdateModal;
