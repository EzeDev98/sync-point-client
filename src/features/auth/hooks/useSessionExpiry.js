import { useEffect } from 'react';

/**
 * Handles the app-wide session-expired event.
 *
 * Uses a full location replace rather than a router navigate: an expired
 * session means the in-memory encryption key and any cached state are no
 * longer trustworthy, and a hard reload is the only way to guarantee they
 * are gone.
 */
export function useSessionExpiry() {
  useEffect(() => {
    function handleSessionExpired() {
      sessionStorage.setItem(
        'sessionExpiredMessage',
        'Your session has expired. Please sign in again.'
      );
      window.location.replace('/login');
    }

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);
}