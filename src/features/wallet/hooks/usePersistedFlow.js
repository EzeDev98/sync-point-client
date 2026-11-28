// Keeps an in-progress payment flow across backgrounding and PIN re-entry.
import { useCallback, useState } from 'react';

export function usePersistedFlow(storageKey) {
  const [initial] = useState(() => readSnapshot(storageKey));

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

  return { initial, persist, clear };
}

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
