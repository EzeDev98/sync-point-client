import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCameraPermissionState, watchCameraPermission } from '@core/camera/cameraPermission';

/**
 * Camera QR scanner lifecycle.
 *
 * SendMoney and ReceivePayment each carried their own copy of this — about
 * ninety lines of refs, promise chaining and teardown, annotated in both
 * files with "identical pattern to the other page". They had already drifted:
 * one logged warnings the other swallowed.
 *
 * The promise chain matters and is preserved. html5-qrcode rejects with
 * "already under transition" if start() and stop() overlap, so every
 * operation is queued onto a single pending promise rather than fired
 * directly. The mounted ref guards against a start() that resolves after
 * the component has gone away, which would otherwise leave the camera on.
 *
 * @param elementId  DOM id the scanner renders into
 * @param active     whether the scanner should currently be running
 * @param onScan     called with the decoded string
 */
export function useQrScanner({ elementId, active, onScan }) {
  const [permission, setPermission] = useState('checking');
  const [error, setError] = useState('');

  const scannerRef = useRef(null);
  const isRunningRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingRef = useRef(Promise.resolve());
  const onScanRef = useRef(onScan);

  // Kept in a ref so a changing callback identity never restarts the camera.
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      pendingRef.current = pendingRef.current
        .catch(() => {})
        .then(() => {
          if (scannerRef.current && isRunningRef.current) {
            isRunningRef.current = false;
            return scannerRef.current.stop().catch(() => {});
          }
          return undefined;
        });
    };
  }, []);

  const stop = useCallback(async () => {
    const operation = pendingRef.current
      .catch(() => {})
      .then(async () => {
        if (scannerRef.current && isRunningRef.current) {
          isRunningRef.current = false;
          try {
            await scannerRef.current.stop();
          } catch (err) {
            console.warn('[useQrScanner] stop() warning:', err?.message || err);
          }
        }
      });

    pendingRef.current = operation;
    await operation;
  }, []);

  const start = useCallback(async () => {
    const operation = pendingRef.current
      .catch(() => {})
      .then(async () => {
        if (!isMountedRef.current || isRunningRef.current) return;

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(elementId);
        }

        try {
          await scannerRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => onScanRef.current?.(decodedText),
            () => {} // per-frame decode failures are noise, not errors
          );

          if (isMountedRef.current) {
            isRunningRef.current = true;
          } else {
            await scannerRef.current.stop().catch(() => {});
          }
        } catch (err) {
          // A start that raced a pending stop is expected, not a failure.
          if (typeof err?.message === 'string' && err.message.includes('already under transition')) {
            console.warn('[useQrScanner] start raced a pending transition:', err.message);
            return;
          }

          console.error('[useQrScanner] Failed to start:', err);
          if (!isMountedRef.current) return;

          // html5-qrcode does not reliably preserve DOMException.name, so
          // any start failure is treated as a permission problem and the
          // real state is re-derived from the Permissions API where possible.
          const state = await getCameraPermissionState();
          setPermission(state === 'unsupported' ? 'denied' : state);
          setError(
            state === 'denied'
              ? 'Camera access is blocked. Allow camera permission for SyncPoint and try again.'
              : 'Camera failed to start. Please try again.'
          );
        }
      });

    pendingRef.current = operation;
    await operation;
  }, [elementId]);

  // Watch permission live, so granting access in the browser's site settings
  // is picked up without the user having to retry by hand.
  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    setPermission('checking');

    getCameraPermissionState().then((state) => {
      if (!cancelled) setPermission(state);
    });

    const unwatch = watchCameraPermission((state) => {
      if (!cancelled) setPermission(state);
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [active]);

  // Only run once permission is known and not denied — an animation that can
  // never become a live feed is worse than the guard panel.
  useEffect(() => {
    if (active && permission !== 'denied' && permission !== 'checking') {
      start();
    } else {
      stop();
    }

    return () => {
      stop();
    };
  }, [active, permission, start, stop]);

  const recheckPermission = useCallback(async () => {
    setError('');
    setPermission(await getCameraPermissionState());
  }, []);

  return { permission, error, clearError: () => setError(''), recheckPermission };
}