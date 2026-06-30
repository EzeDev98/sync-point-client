// ============================================
// VERSION SERVICE — SyncPoint
// Detects new deployments. Only ever called right
// before login starts (see Login.jsx).
// ============================================


const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";
const VERSION_URL = "/version.json";


const SEEN_PROMPT_KEY = "sp_update_prompt_seen_for_build";

/**
 * Fetches version.json with cache busting so we never read a stale
 * SW-cached or HTTP-cached copy of the manifest itself.
 */
export async function fetchRemoteBuildId() {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.buildId || null;
  } catch (err) {
    console.warn("[VersionService] Could not fetch version.json:", err);
    return null;
  }
}

/**
 * Returns true if a newer build exists AND the user hasn't already been
 * shown (and dismissed) the prompt for this exact build this session.
 */
export async function checkForUpdate() {
  const remoteBuildId = await fetchRemoteBuildId();
  if (!remoteBuildId || remoteBuildId === CURRENT_BUILD_ID) {
    return { updateAvailable: false };
  }

  const alreadyPromptedFor = sessionStorage.getItem(SEEN_PROMPT_KEY);
  if (alreadyPromptedFor === remoteBuildId) {
    return { updateAvailable: false };
  }

  return { updateAvailable: true, remoteBuildId };
}

export function markPromptSeen(remoteBuildId) {
  sessionStorage.setItem(SEEN_PROMPT_KEY, remoteBuildId);
}

export function getCurrentBuildId() {
  return CURRENT_BUILD_ID;
}