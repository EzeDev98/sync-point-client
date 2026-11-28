// Blocks a route until the app is installed as a PWA.
import { Navigate } from 'react-router-dom';
import { isPWAInstalled } from '@features/device/services/deviceCompatibility';
import { ROUTES } from '@app/router/routes';

function InstallGuard({ children }) {
  if (!isPWAInstalled()) {
    return <Navigate to={ROUTES.INSTALL} replace />;
  }

  return children;
}

export default InstallGuard;
