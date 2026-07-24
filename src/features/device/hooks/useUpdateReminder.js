import { useCallback, useEffect, useRef, useState } from 'react';
import { getIsOnline } from '@core/network/networkService';
import { checkForUpdate, markPromptSeen } from '@features/device/services/versionService';

/** How often to check whether a newer build has been deployed. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Polls for a newer build while the user is signed in.
 *
 * The reminder is advisory only — an update cannot be applied mid-session
 * because pending transactions would be lost, so this just prompts the user
 * to sync and sign out. Login applies the update itself.
 *
 * Dismissing records the build id, so the same version is not raised again
 * this session. Without that, the five-minute poll re-opened the modal
 * indefinitely: versionService checked for a dismissal that nothing ever
 * wrote.
 */
export function useUpdateReminder() {
  const [isAvailable, setIsAvailable] = useState(false);

  // Held in a ref because dismiss() needs it without re-running the poll.
  const remoteBuildIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!getIsOnline()) return;
      if (!localStorage.getItem('walletId')) return;

      try {
        const { updateAvailable, remoteBuildId } = await checkForUpdate();

        if (!cancelled && updateAvailable) {
          remoteBuildIdRef.current = remoteBuildId;
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
    if (remoteBuildIdRef.current) {
      markPromptSeen(remoteBuildIdRef.current);
    }
    setIsAvailable(false);
  }, []);

  return { isAvailable, dismiss };
}