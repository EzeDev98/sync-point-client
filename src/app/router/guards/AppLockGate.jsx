import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PROTECTED_PATHS, ROUTES } from '@app/router/routes';

/**
 * Locks the wallet whenever the app leaves the foreground, and forces PIN
 * re-entry on return if the user is on a protected route.
 *
 * Renders nothing — it exists only for the visibility listener.
 */
function AppLockGate() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleVisibilityChange() {
      if (!localStorage.getItem('walletId')) return;

      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('walletLocked', 'true');
        return;
      }

      const isLocked = sessionStorage.getItem('walletLocked') === 'true';
      const isProtected = PROTECTED_PATHS.some((path) => location.pathname.startsWith(path));

      if (isLocked && isProtected) {
        navigate(ROUTES.VERIFY_PIN, { replace: true });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [navigate, location.pathname]);

  return null;
}

export default AppLockGate;