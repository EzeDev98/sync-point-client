// Sends the user to sign-in when the session expires.
import { useEffect } from 'react';

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
