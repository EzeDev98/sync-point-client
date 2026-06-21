import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that manages Service Worker registration, online/offline state,
 * update detection, and cache utilities.
 */
export function useServiceWorker() {

  const [swRegistration, setSwRegistration] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  const registrationRef = useRef(null);

  useEffect(() => {

    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      setSwRegistration(registration);
      registrationRef.current = registration;

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (
            installingWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            setIsUpdateAvailable(true);
          }
        });
      });
    });

    function handleSWMessage(event) {
      if (!event.data) return;
      const { type, payload } = event.data;

      switch (type) {
        case 'SYNC_STARTED':
          console.log('[App] Sync started');
          break;
        case 'SYNC_COMPLETED':
          console.log('[App] Sync completed:', payload);
          break;
        case 'CACHE_SIZE':
          console.log('[App] Cache size:', payload?.size);
          break;
        default:
          console.log('[App] SW message:', type, payload);
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!swRegistration) return;
    try {
      await swRegistration.update();
      console.log('[App] Checked for SW updates');
    } catch (error) {
      console.error('[App] SW update check failed:', error);
    }
  }, [swRegistration]);

  const clearCache = useCallback(async () => {
    if (!swRegistration?.active) return;
    swRegistration.active.postMessage({ type: 'CLEAR_CACHE' });
  }, [swRegistration]);
  
  const getCacheSize = useCallback(() => {
    return new Promise((resolve) => {
      if (!swRegistration?.active) {
        resolve(0);
        return;
      }

      const timeoutId = setTimeout(() => {
        console.warn('[App] getCacheSize timed out — SW did not reply');
        resolve(0);
      }, 5000);

      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        clearTimeout(timeoutId);
        if (event.data?.type === 'CACHE_SIZE') {
          resolve(event.data.payload?.size ?? 0);
        } else {
          resolve(0);
        }
      };

      swRegistration.active.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      );
    });
  }, [swRegistration]);


  const skipWaiting = useCallback(() => {
    swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }, [swRegistration]);

  return { swRegistration, isOnline, isUpdateAvailable, checkForUpdate, clearCache, getCacheSize, skipWaiting, };
}