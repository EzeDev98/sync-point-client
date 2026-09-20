/**
 * Detects new deployments by comparing the running build against the one
 * currently published.
 */

const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
const VERSION_URL = '/version.json';

/**
 * The build this device last fully applied (a hard reset that cleaned the service worker and
 * caches). Kept apart from the running bundle on purpose: navigations are network-first, so a
 * fresh page load always runs the newest bundle even though the device was never reset.
 */
const APPLIED_BUILD_KEY = 'applied_build_id';

function readAppliedBuildId() {
  try {
    return localStorage.getItem(APPLIED_BUILD_KEY);
  } catch {
    return null;
  }
}

export function markBuildApplied(buildId) {
  if (!buildId) return;
  try {
    localStorage.setItem(APPLIED_BUILD_KEY, buildId);
  } catch {
    // Storage unavailable: the next check simply treats this device as up to date.
  }
}

/** First run on a device: there is nothing to update from, so the running build counts as applied. */
export function seedAppliedBuildId() {
  if (readAppliedBuildId() === null) markBuildApplied(CURRENT_BUILD_ID);
}

/**
 * Cache-busted on purpose. The service worker caches aggressively, and a
 * cached version.json would report the running build as current forever —
 * the update would never be discoverable.
 *
 * Returns null in development. version.json is written by the
 * version-manifest plugin's writeBundle hook, which only runs on `vite
 * build`, so the file does not exist under `vite dev`. Requesting it there
 * hits the SPA fallback and receives index.html, and parsing that as JSON
 * threw on every poll — five minutes apart, forever.
 */
export async function fetchRemoteBuildId() {
  if (import.meta.env.DEV) return null;

  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;

    // A proxy, an offline fallback or a misconfigured host can answer with
    // HTML and a 200. Checking the type is cheaper than catching the parse.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('[versionService] version.json returned', contentType, '— skipping.');
      return null;
    }

    const data = await response.json();
    return data.buildId || null;
  } catch (err) {
    console.warn('[versionService] Could not fetch version.json:', err);
    return null;
  }
}

/**
 * True whenever a newer build exists than the one currently running.
 *
 * Intentionally not session-suppressed: the modal is meant to keep
 * re-surfacing on every poll (see useUpdateReminder) until the user signs
 * out and updates, so a newer remoteBuildId is reported every time it's
 * still there, not just once.
 */
export async function checkForUpdate() {
  const remoteBuildId = await fetchRemoteBuildId();

  // Up to date means BOTH: this bundle is the published one, and this device has applied that
  // build. Without the second half a fresh load of /login never reports an update.
  const appliedBuildId = readAppliedBuildId() ?? CURRENT_BUILD_ID;

  if (!remoteBuildId || (remoteBuildId === CURRENT_BUILD_ID && remoteBuildId === appliedBuildId)) {
    return { updateAvailable: false };
  }

  return { updateAvailable: true, remoteBuildId };
}

export function getCurrentBuildId() {
  return CURRENT_BUILD_ID;
}