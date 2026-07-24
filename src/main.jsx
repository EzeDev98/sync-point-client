import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Global stylesheet chain — order is significant.
//   tokens → every custom property the rest of the CSS depends on
//   reset  → normalisation, must land before any element defaults
//   base   → element defaults expressed in tokens
// Component styling lives in co-located *.module.css files, never here.
import './styles/tokens.css';
import './styles/reset.css';
import './styles/base.css';

import { configureHttpClient } from './core/http/httpClient';
import { getValidToken } from './features/auth/services/tokenStore';
import DeviceGate from './features/device/pages/DeviceGate/DeviceGate.jsx';
import App from './app/App.jsx';

// Wire the HTTP client's auth. Injected here rather than imported inside
// core/http so that core stays independent of any feature, and so the
// api ↔ token circular import the old code had cannot come back.
configureHttpClient({ tokenProvider: getValidToken });

// Capture beforeinstallprompt as early as possible — before any component
// mounts. InstallPage reads from window.__installPrompt when it's ready.
window.__installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // suppress the browser's default mini-infobar
  window.__installPrompt = e;
  console.log('[main] beforeinstallprompt captured');
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('pwa_installed', 'true');
  console.log('[main] appinstalled — flag set');
});

// Service worker registration.
//
// sw.js is built correctly (BUILD_ID stamped, precache list, fetch handlers)
// but nothing registers it unless this runs, and an unregistered worker never
// activates or controls navigations. Without it, a hard refresh on a deep
// route while offline has nothing to intercept the request: it goes straight
// to the network, fails, and Chrome shows its own offline screen instead of
// ours.
//
// Registered on 'load' rather than immediately so it never competes with the
// initial render.
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