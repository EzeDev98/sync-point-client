// Application entry point: styles, service worker registration and root render.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';
import './styles/reset.css';
import './styles/base.css';

import { configureHttpClient } from './core/http/httpClient';
import { seedAppliedBuildId } from './features/device/services/versionService';
import { getValidToken, handleSessionRevoked } from './features/auth/services/tokenStore';
import DeviceGate from './features/device/pages/DeviceGate/DeviceGate.jsx';
import App from './app/App.jsx';

configureHttpClient({ tokenProvider: getValidToken, onSessionRevoked: handleSessionRevoked });

seedAppliedBuildId();

window.__installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  console.log('[main] beforeinstallprompt captured');
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('pwa_installed', 'true');
  console.log('[main] appinstalled — flag set');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[main] Service worker registered:', registration.scope);
      })
      .catch((err) => {
        console.error('[main] Service worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DeviceGate>
      <App />
    </DeviceGate>
  </StrictMode>,
);
