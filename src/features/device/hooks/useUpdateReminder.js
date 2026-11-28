// Periodically checks for a newer deployed build.
import { useCallback, useEffect, useState } from 'react';
import { getIsOnline } from '@core/network/networkService';
import { checkForUpdate } from '@features/device/services/versionService';

const POLL_INTERVAL_MS = 3 * 60 * 1000;

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
