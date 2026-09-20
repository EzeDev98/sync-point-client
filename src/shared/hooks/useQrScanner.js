import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCameraPermissionState, watchCameraPermission } from '@core/camera/cameraPermission';

/**
 * Camera QR scanner lifecycle.
 *
 * Every operation is queued onto one pending promise, because html5-qrcode
 * rejects overlapping start()/stop() calls.
 *
 * A scanner instance is never reused. html5-qrcode's stop() throws when it
 * runs before the video has fired "playing" (its canvas does not exist yet) or
 * when the element it rendered into has been unmounted. When that happens the
 * instance is left permanently mid-transition, and every later start() on it
 * fails with "Cannot clear while scan is ongoing" — the camera never comes on
 * and only a page reload cleared it. So each start() builds a fresh instance,
 * and teardown() always discards the old one and releases its camera stream
 * itself, whether or not the library's own stop() succeeded.
 *
 * @param elementId  DOM id the scanner renders into
 * @param active     whether the scanner should currently be running
 * @param onScan     called with the decoded string
 */
export function useQrScanner({ elementId, active, onScan }) {
  const [permission, setPermission] = useState('checking');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const scannerRef = useRef(null);
  const isMountedRef = useRef(true);
  const pendingRef = useRef(Promise.resolve());
  const onScanRef = useRef(onScan);

  // Kept in a ref so a changing callback identity never restarts the camera.
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Discards the current scanner and guarantees the camera is released.
  // Must only be called from inside the queue.
  const teardown = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    const container = scanner.element;

    try {
      await scanner.stop();
    } catch (err) {
      // Expected when stop() raced the video starting; the stream is released below.
      console.warn('[useQrScanner] stop() warning:', err?.message || err);
    }

    // The library can throw before or after releasing the stream, so stop any
    // track still attached to the video it rendered.
    container?.querySelectorAll?.('video').forEach((video) => {
      video.srcObject?.getTracks?.().forEach((track) => track.stop());
      video.srcObject = null;
    });

    try {
      scanner.clear();
    } catch {
      // Already cleared, or the container is gone.
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

        // The viewfinder may have been unmounted between queuing and running.
        if (!document.getElementById(elementId)) return;

        try {
          scannerRef.current = new Html5Qrcode(elementId);
          await scannerRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => onScanRef.current?.(decodedText),
            () => {} // per-frame decode failures are noise, not errors
          );

          if (!isMountedRef.current) await teardown();
        } catch (err) {
          console.error('[useQrScanner] Failed to start:', err);
          await teardown();
          if (!isMountedRef.current) return;

          // html5-qrcode rejects with plain strings, not DOMExceptions, so the
          // real state is re-derived from the Permissions API where possible.
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

  // Watch permission live, so granting access in the browser's site settings
  // is picked up without the user having to retry by hand. The state is not
  // reset to "checking" on re-activation: that would unmount the viewfinder
  // while the camera is starting.
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

  // A boolean, so prompt -> granted (which happens the moment the user allows
  // the camera) does not stop and restart a scanner that is already starting.
  const shouldRun = active && permission !== 'denied' && permission !== 'checking';

  // `attempt` is bumped by the Try again button so a failed start is retried
  // even though nothing else about the hook's state has changed.
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
