import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DeviceGate from './pages/DeviceGate'
import InstallPrompt from './pages/InstallPrompt'
import './index.css'
import App from './App.jsx'


window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.log('New version available!');
              // Show update notification to user
              showUpdateNotification();
            }
          });
        });
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Update notification
function showUpdateNotification() {
  // You can show a toast/notification to the user
  const updateMessage = document.createElement('div');
  updateMessage.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #0F766E;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  updateMessage.innerHTML = `
    <span>🔄 New version available!</span>
    <button style="
      background: white;
      color: #0F766E;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    ">Update Now</button>
  `;
  
  document.body.appendChild(updateMessage);
  
  updateMessage.querySelector('button').addEventListener('click', () => {
    document.body.removeChild(updateMessage);
    window.location.reload();
  });
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (document.body.contains(updateMessage)) {
      document.body.removeChild(updateMessage);
    }
  }, 30000);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DeviceGate>
      <App />
      <InstallPrompt />
    </DeviceGate>
  </StrictMode>,
)