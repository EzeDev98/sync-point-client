import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import installService from '../services/installService';

/**
 * InstallGuard - Route guard that requires PWA installation
 * 
 * This component checks if the app is installed and redirects
 * to the installation flow if not.
 */
function InstallGuard({ children }) {
  const [isInstalled, setIsInstalled] = useState(installService.isPWAInstalled());
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Subscribe to installation state changes
    const unsubscribe = installService.subscribe((state) => {
      setIsInstalled(state.isInstalled);
      setIsChecking(false);
    });

    // Initial check
    setIsInstalled(installService.isPWAInstalled());
    setIsChecking(false);

    return unsubscribe;
  }, []);

  // Show nothing while checking
  if (isChecking) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Checking installation...</p>
      </div>
    );
  }

  // Redirect to installation if not installed
  if (!isInstalled) {
    return <Navigate to="/install" replace />;
  }

  // Render children if installed
  return children;
}

const styles = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #E5E7EB',
    borderTopColor: '#0F766E',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#6B7280',
  },
};

export default InstallGuard;