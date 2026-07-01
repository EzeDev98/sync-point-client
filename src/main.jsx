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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DeviceGate>
      <App />
    </DeviceGate>
  </StrictMode>,
)