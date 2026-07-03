import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DeviceGate from './pages/DeviceGate'
import './index.css'
import App from './App.jsx'

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

// ============================================
// SERVICE WORKER REGISTRATION (was missing)
// ============================================
// sw.js was being built correctly (BUILD_ID stamped, precache list, fetch
// handlers all present) but nothing in the app ever called
// navigator.serviceWorker.register(...). Without registration the SW never
// installs or activates, so it never controls navigations. That's why a
// hard refresh on a deep route (e.g. /dashboard) while offline had nothing
// to intercept the request — the browser sent it straight to the network,
// it failed with net::ERR_INTERNET_DISCONNECTED, and Chrome fell back to
// its own built-in offline screen for installed PWAs instead of your app.
//
// Registered on 'load' (not immediately) so it never competes with or
// delays the initial page render/paint.
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
)