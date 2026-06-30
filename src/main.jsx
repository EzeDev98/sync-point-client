import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DeviceGate from './pages/DeviceGate'
import InstallGate from './pages/InstallGate'
import './index.css'
import App from './App.jsx'

window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DeviceGate>
      <InstallGate>
        <App />
      </InstallGate>
    </DeviceGate>
  </StrictMode>,
)