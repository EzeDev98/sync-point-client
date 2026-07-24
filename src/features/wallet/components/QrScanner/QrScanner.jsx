import { Button, Card, EmptyState } from '@shared/components/ui';
import styles from './QrScanner.module.css';

/**
 * Camera viewfinder with its permission states.
 *
 * The blocked-permission panel and the "checking" placeholder were written
 * out separately in SendMoney and ReceivePayment; both live here now.
 * The scanner itself is driven by useQrScanner — this component only renders
 * the frame it draws into, identified by `elementId`.
 */
function QrScanner({ elementId, permission, instruction, hint, onRetryPermission }) {
  if (permission === 'denied') {
    return (
      <Card centered>
        <div className={styles.blockedIcon} aria-hidden="true">
          🚫
        </div>
        <h2 className={styles.blockedTitle}>Camera access is blocked</h2>
        <p className={styles.blockedBody}>
          Camera permission was denied for SyncPoint, so QR scanning cannot work until
          it is allowed again.
        </p>
        <p className={styles.blockedHint}>
          Tap the lock or site-info icon next to the address bar and allow Camera
          access. We pick that up automatically — or use the button below once you have
          changed it.
        </p>
        <Button className={styles.retryButton} onClick={onRetryPermission}>
          I&apos;ve enabled it — try again
        </Button>
      </Card>
    );
  }

  if (permission === 'checking') {
    return (
      <Card centered>
        <EmptyState>Checking camera access...</EmptyState>
      </Card>
    );
  }

  return (
    <>
      {instruction && (
        <div className={styles.instruction}>
          <p className={styles.instructionText}>{instruction}</p>
        </div>
      )}

      <div className={styles.wrapper}>
        <div className={styles.box}>
          <div className={[styles.corner, styles.topLeft].join(' ')} aria-hidden="true" />
          <div className={[styles.corner, styles.topRight].join(' ')} aria-hidden="true" />
          <div className={[styles.corner, styles.bottomLeft].join(' ')} aria-hidden="true" />
          <div className={[styles.corner, styles.bottomRight].join(' ')} aria-hidden="true" />
          <div className={styles.scanLine} aria-hidden="true" />
          <div id={elementId} className={styles.reader} />
        </div>
      </div>

      {hint && <p className={styles.hint}>{hint}</p>}
    </>
  );
}

export default QrScanner;