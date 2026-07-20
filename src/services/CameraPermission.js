// ============================================
// CAMERA PERMISSION HELPER
// ============================================
//
// html5-qrcode's start() promise doesn't reliably surface a usable
// DOMException.name when the camera fails to start (in practice it often
// rejects with a plain string), so branching on err.name to tell "user
// denied permission" apart from "camera hardware issue" is unreliable.
//
// The Permissions API lets us know the actual state (granted / denied /
// prompt) BEFORE we ever try to open the camera, so a user who has
// already denied access can be told immediately — instead of watching a
// scan animation that will never turn into a live camera feed.
//
// Support note: Chrome/Edge/Firefox support querying {name: "camera"}.
// Safari (as of recent versions) does too, but older WebKit does not —
// callers must treat "unsupported" as "we don't know, just try."

/**
 * @returns {Promise<"granted"|"denied"|"prompt"|"unsupported">}
 */
export async function getCameraPermissionState() {
  if (!navigator.permissions || !navigator.permissions.query) {
    return "unsupported";
  }
  try {
    const status = await navigator.permissions.query({ name: "camera" });
    return status.state;
  } catch {
    // Some browsers support navigator.permissions but throw on an
    // unrecognized descriptor name (older Firefox didn't know "camera").
    return "unsupported";
  }
}

/**
 * Subscribes to live permission changes — e.g. the user grants camera
 * access from the browser's site-settings UI while this tab is still
 * open. Calls onChange(state) whenever it changes.
 *
 * Safely no-ops if the Permissions API isn't supported.
 *
 * @param {(state: "granted"|"denied"|"prompt") => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchCameraPermission(onChange) {
  if (!navigator.permissions || !navigator.permissions.query) {
    return () => {};
  }

  let cancelled = false;
  let statusRef = null;
  const handleChange = () => {
    if (!cancelled && statusRef) onChange(statusRef.state);
  };

  navigator.permissions
    .query({ name: "camera" })
    .then((status) => {
      if (cancelled) return;
      statusRef = status;
      status.addEventListener("change", handleChange);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    if (statusRef) statusRef.removeEventListener("change", handleChange);
  };
}