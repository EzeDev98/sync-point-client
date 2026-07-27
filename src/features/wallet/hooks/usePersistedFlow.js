import { useCallback, useRef } from 'react';

/**
 * Persists an in-progress transaction flow so it survives the app being
 * backgrounded — screen lock, an incoming call, minimising — and the PIN
 * re-verification that follows on return.
 *
 * Why sessionStorage: a half-finished transfer should outlive a lock/unlock
 * within the same app session, but must not linger after the app is fully
 * closed. sessionStorage gives exactly that lifetime.
 *
 * Why a TTL: a lock/call/minimise resume happens within seconds. A flow the
 * user wandered away from and returns to much later should start fresh rather
 * than silently dropping them back into a stale screen. The snapshot carries a
 * timestamp and is ignored (and cleared) once older than {@link FLOW_TTL_MS}.
 *
 * Security: the caller must never put the entered PIN into the snapshot. Only
 * non-secret flow state (step, request, generated/scanned payload, amount)
 * belongs here.
 *
 * @param {string} storageKey unique per flow, e.g. 'send:flow' / 'receive:flow'
 * @returns {{ initial: object|null, persist: (snapshot: object) => void, clear: () => void }}
 */
export function usePersistedFlow(storageKey) {
  // Read once, synchronously, so the value is available to lazy state
  // initializers on the very first render — before any effect runs.
  const initialRef = useRef(undefined);
  if (initialRef.current === undefined) {
    initialRef.current = readSnapshot(storageKey);
  }

  const persist = useCallback(
    (snapshot) => {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ savedAt: Date.now(), data: snapshot })
        );
      } catch (err) {
        console.warn(`[flow] Could not persist ${storageKey}:`, err.message);
      }
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  return { initial: initialRef.current, persist, clear };
}

/** Fifteen minutes — comfortably longer than any lock/call, short enough to bound staleness. */
export const FLOW_TTL_MS = 15 * 60 * 1000;

function readSnapshot(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number') return null;

    if (Date.now() - parsed.savedAt > FLOW_TTL_MS) {
      sessionStorage.removeItem(storageKey);
      return null;
    }

    return parsed.data ?? null;
  } catch (err) {
    console.warn(`[flow] Could not read ${storageKey}:`, err.message);
    return null;
  }
}