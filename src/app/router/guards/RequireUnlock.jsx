import { Navigate } from 'react-router-dom';
import { ROUTES } from '@app/router/routes';

/**
 * Redirects to PIN entry when a session exists but the wallet is locked.
 *
 * Reads storage directly rather than through state: this runs during render
 * on every protected navigation, and the value must reflect what the lock
 * gate wrote a moment earlier, not a re-rendered copy of it.
 */
function RequireUnlock({ children }) {
  const hasSession = Boolean(localStorage.getItem('walletId'));
  const isLocked = sessionStorage.getItem('walletLocked') === 'true';

  if (hasSession && isLocked) {
    return <Navigate to={ROUTES.VERIFY_PIN} replace />;
  }

  return children;
}

export default RequireUnlock;