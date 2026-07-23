import Button from '../../ui/Button/Button.jsx';
import Modal from '../../ui/Modal/Modal.jsx';

/**
 * Prompts the user to load a newer build.
 *
 * All three inline style objects are gone: the side-by-side button layout is
 * Modal's `actions` slot, which already distributes its children evenly.
 *
 * A mandatory update cannot be dismissed, so overlay and Escape dismissal are
 * both disabled in that case.
 */
function UpdateModal({ onLater, onUpdate, isUpdating, mandatory = false }) {
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
    </Modal>
  );
}

export default UpdateModal;