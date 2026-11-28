// Detects new deployments by comparing build ids.
const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
const VERSION_URL = '/version.json';

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
  }
}

export function seedAppliedBuildId() {
  if (readAppliedBuildId() === null) markBuildApplied(CURRENT_BUILD_ID);
}

export async function fetchRemoteBuild() {
  if (import.meta.env.DEV) return { buildId: null, failed: false };

  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return { buildId: null, failed: true };

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('[versionService] version.json returned', contentType, '— skipping.');
      return { buildId: null, failed: true };
    }

    const data = await response.json();
    return data.buildId ? { buildId: data.buildId, failed: false } : { buildId: null, failed: true };
  } catch (err) {
    console.warn('[versionService] Could not fetch version.json:', err);
    return { buildId: null, failed: true };
  }
}

export async function fetchRemoteBuildId() {
  return (await fetchRemoteBuild()).buildId;
}

export async function checkForUpdate() {
  const { buildId: remoteBuildId, failed } = await fetchRemoteBuild();

  if (failed) return { updateAvailable: false, checkFailed: true };

  const appliedBuildId = readAppliedBuildId() ?? CURRENT_BUILD_ID;

  if (!remoteBuildId || (remoteBuildId === CURRENT_BUILD_ID && remoteBuildId === appliedBuildId)) {
    return { updateAvailable: false };
  }

  return { updateAvailable: true, remoteBuildId };
}

export function getCurrentBuildId() {
  return CURRENT_BUILD_ID;
}
