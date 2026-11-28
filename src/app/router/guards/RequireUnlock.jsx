// Redirects to PIN entry when the session exists but the wallet is locked.
import { Navigate } from 'react-router-dom';
import { ROUTES } from '@app/router/routes';

function RequireUnlock({ children }) {
  const hasSession = Boolean(localStorage.getItem('walletId'));
  const isLocked = sessionStorage.getItem('walletLocked') === 'true';

  if (hasSession && isLocked) {
    return <Navigate to={ROUTES.VERIFY_PIN} replace />;
  }

  return children;
}

export default RequireUnlock;
