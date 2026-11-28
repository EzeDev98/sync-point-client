// Renders a payment payload as a QR code with its amount and reference.
import { QRCodeSVG } from 'qrcode.react';
import { formatNaira } from '@shared/utils';
import styles from './QrDisplay.module.css';

function QrDisplay({ payload, label, amount, reference, size = 260, expired = false, children }) {
  return (
    <div className={styles.card}>
      {label && <span className={styles.label}>{label}</span>}

      {amount !== undefined && <div className={styles.amount}>{formatNaira(amount)}</div>}

      <div className={styles.box}>
        {expired ? (
          <div className={styles.expired}>
            <span aria-hidden="true">❌</span>
            <p>QR expired</p>
          </div>
        ) : (
          <QRCodeSVG
            value={typeof payload === 'string' ? payload : JSON.stringify(payload)}
            size={size}
            bgColor="#FFFFFF"
            fgColor="#111827"
            level="M"
          />
        )}
      </div>

      {reference && <div className={styles.reference}>{reference}</div>}

      {children}
    </div>
  );
}

export default QrDisplay;
