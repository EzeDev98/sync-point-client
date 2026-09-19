import { useCallback, useEffect, useState } from 'react';
import { getIsOnline } from '@core/network/networkService';
import { checkForUpdate } from '@features/device/services/versionService';

/** How often to check whether a newer build has been deployed. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Polls for a newer build while the user is signed in.
 *
 * The reminder is advisory only — an update cannot be applied mid-session
 * because pending transactions would be lost, so this just prompts the user
 * to sync and sign out. Login applies the update itself.
 *
 * Dismissing only closes the modal for now — it is not persisted, so the
 * next poll re-opens it while the update is still pending. That repetition
 * is intentional: this is meant to keep reminding the user until they
 * actually sign out and update.
 */
export function useUpdateReminder() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!getIsOnline()) return;
      if (!localStorage.getItem('walletId')) return;

      try {
        const { updateAvailable } = await checkForUpdate();

        if (!cancelled && updateAvailable) {
          setIsAvailable(true);
        }
      } catch (err) {
        console.warn('[useUpdateReminder] Check failed:', err);
      }
    }

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const dismiss = useCallback(() => {
    setIsAvailable(false);
  }, []);

  return { isAvailable, dismiss };
}