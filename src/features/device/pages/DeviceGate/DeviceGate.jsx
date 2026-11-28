// Blocks the app on devices that cannot run it.
import { useState } from 'react';
import { checkDeviceCompatibility } from '@features/device/services/deviceCompatibility';
import styles from './DeviceGate.module.css';

function DeviceGate({ children }) {
  const [compatibility] = useState(checkDeviceCompatibility);

  if (compatibility.isCompatible) return children;

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          📵
        </div>

        <h2 className={styles.title}>Device not supported</h2>

        <p className={styles.message}>{compatibility?.message}</p>

        <div className={styles.requirements}>
          <strong>Minimum requirements:</strong>
          <ul className={styles.requirementList}>
            <li>Android 7.0+ (2016 or later)</li>
            <li>iOS 10+ (2016 or later)</li>
            <li>Modern browser (Chrome, Safari, Firefox)</li>
          </ul>
        </div>

        <p className={styles.footnote}>
          Please update your device or use a more recent phone to access SyncPoint.
        </p>
      </div>
    </div>
  );
}

export default DeviceGate;
