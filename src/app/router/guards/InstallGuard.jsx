import { Navigate } from 'react-router-dom';
import { isPWAInstalled } from '@features/device/services/deviceCompatibility';
import { ROUTES } from '@app/router/routes';

/**
 * Blocks a route until the app has been installed as a PWA.
 *
 * The offline experience depends on the service worker and the standalone
 * display mode, neither of which is reliable in a plain browser tab.
 */
function InstallGuard({ children }) {
  if (!isPWAInstalled()) {
    return <Navigate to={ROUTES.INSTALL} replace />;
  }

  return children;
}

export default InstallGuard;