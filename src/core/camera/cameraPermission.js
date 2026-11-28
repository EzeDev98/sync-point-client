// Reads and requests camera permission before the QR scanner opens.
function canQueryPermissions() {
  return Boolean(navigator.permissions?.query);
}

export async function getCameraPermissionState() {
  if (!canQueryPermissions()) return 'unsupported';

  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    return status.state;
  } catch {
    return 'unsupported';
  }
}

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
