// Camera QR scanner lifecycle with serialised start and stop.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCameraPermissionState, watchCameraPermission } from '@core/camera/cameraPermission';

export function useQrScanner({ elementId, active, onScan }) {
  const [permission, setPermission] = useState('checking');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const scannerRef = useRef(null);
  const isMountedRef = useRef(true);
  const pendingRef = useRef(Promise.resolve());
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const teardown = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    const container = scanner.element;

    try {
      await scanner.stop();
    } catch (err) {
      console.warn('[useQrScanner] stop() warning:', err?.message || err);
    }

    container?.querySelectorAll?.('video').forEach((video) => {
      video.srcObject?.getTracks?.().forEach((track) => track.stop());
      video.srcObject = null;
    });

    try {
      scanner.clear();
    } catch {
    }
  }, []);

  const enqueue = useCallback((operation) => {
    const next = pendingRef.current.catch(() => {}).then(operation);
    pendingRef.current = next;
    return next;
  }, []);

  const stop = useCallback(() => enqueue(teardown), [enqueue, teardown]);

  const start = useCallback(
    () =>
      enqueue(async () => {
        if (!isMountedRef.current || scannerRef.current) return;

        if (!document.getElementById(elementId)) return;

        try {
          scannerRef.current = new Html5Qrcode(elementId);
          await scannerRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => onScanRef.current?.(decodedText),
            () => {}
          );

          if (!isMountedRef.current) await teardown();
        } catch (err) {
          console.error('[useQrScanner] Failed to start:', err);
          await teardown();
          if (!isMountedRef.current) return;

          const state = await getCameraPermissionState();
          setPermission(state === 'unsupported' ? 'denied' : state);
          setError(
            state === 'denied'
              ? 'Camera access is blocked. Allow camera permission for SyncPoint and try again.'
              : 'Camera failed to start. Please try again.'
          );
        }
      }),
    [elementId, enqueue, teardown]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

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

  const shouldRun = active && permission !== 'denied' && permission !== 'checking';

  useEffect(() => {
    if (shouldRun) start();

    return () => {
      stop();
    };
  }, [shouldRun, attempt, start, stop]);

  const recheckPermission = useCallback(async () => {
    setError('');
    setAttempt((count) => count + 1);
    setPermission(await getCameraPermissionState());
  }, []);

  return { permission, error, clearError: () => setError(''), recheckPermission };
}
