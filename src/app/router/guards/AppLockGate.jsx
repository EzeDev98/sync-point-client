// Locks the wallet when the app leaves the foreground and asks for the PIN on return.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PROTECTED_PATHS, ROUTES } from '@app/router/routes';

function AppLockGate() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleVisibilityChange() {
      if (!localStorage.getItem('walletId')) return;

      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('walletLocked', 'true');

        const onProtectedRoute = PROTECTED_PATHS.some((path) =>
          location.pathname.startsWith(path)
        );
        if (onProtectedRoute && !location.pathname.startsWith(ROUTES.VERIFY_PIN)) {
          sessionStorage.setItem('lockReturnTo', location.pathname);
        }
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
