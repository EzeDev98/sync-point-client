/**
 * Camera permission state, read ahead of opening the camera.
 *
 * html5-qrcode's start() promise does not reliably surface a usable
 * DOMException.name when the camera fails — in practice it often rejects
 * with a plain string — so branching on err.name to tell "user denied
 * permission" apart from "hardware unavailable" does not work.
 *
 * The Permissions API gives the real state before the camera is ever
 * touched, so someone who has already denied access is told immediately
 * rather than watching a scan animation that can never become a live feed.
 *
 * Support: Chrome, Edge, Firefox and recent Safari can query the "camera"
 * descriptor. Older WebKit cannot, so callers must read "unsupported" as
 * "unknown — try anyway" rather than as a failure.
 */

function canQueryPermissions() {
  return Boolean(navigator.permissions?.query);
}

/**
 * @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>}
 */
export async function getCameraPermissionState() {
  if (!canQueryPermissions()) return 'unsupported';

  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    return status.state;
  } catch {
    // Some browsers expose navigator.permissions but throw on a descriptor
    // they do not recognise — older Firefox did not know "camera".
    return 'unsupported';
  }
}

/**
 * Subscribes to live permission changes — for instance the user granting
 * access from the browser's site settings while this tab stays open, which
 * is exactly the case the scanner's retry button exists to cover.
 *
 * No-ops safely when the Permissions API is unavailable.
 *
 * @param {(state: 'granted'|'denied'|'prompt') => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchCameraPermission(onChange) {
  if (!canQueryPermissions()) return () => {};

  let cancelled = false;
  let status = null;

  function handleChange() {
    if (!cancelled && status) onChange(status.state);
  }

  navigator.permissions
    .query({ name: 'camera' })
    .then((result) => {
      // The query is async, so the caller may already have unsubscribed by
      // the time it resolves — attaching a listener then would leak it.
      if (cancelled) return;

      status = result;
      status.addEventListener('change', handleChange);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    if (status) status.removeEventListener('change', handleChange);
  };
}