import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DeviceGate from './pages/DeviceGate';
import './index.css';
import App from './App.jsx';

// NOTE: beforeinstallprompt is now handled exclusively by installService
// Do NOT add any beforeinstallprompt listeners here

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DeviceGate>
      <App />
    </DeviceGate>
  </StrictMode>,
);