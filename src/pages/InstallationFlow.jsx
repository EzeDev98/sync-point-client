import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import installService from '../services/installService';
import AppLogo from '../components/AppLogo';

/**
 * InstallationFlow - Complete installation flow page
 * 
 * This page handles:
 * 1. Checking installation status
 * 2. Waiting for beforeinstallprompt
 * 3. Showing install button when available
 * 4. Showing manual instructions for unsupported browsers
 * 5. Redirecting to Welcome when installed
 */
function InstallationFlow() {
  const navigate = useNavigate();
  const [state, setState] = useState(installService.getState());
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState(null);

  // Subscribe to installation state changes
  useEffect(() => {
    const unsubscribe = installService.subscribe((newState) => {
      setState(newState);
      
      // Auto-redirect when installed
      if (newState.isInstalled) {
        console.log('[InstallationFlow] App installed, redirecting to welcome');
        setTimeout(() => {
          navigate('/welcome', { replace: true });
        }, 1000);
      }
    });

    // Check initial state
    if (installService.isPWAInstalled()) {
      navigate('/welcome', { replace: true });
    }

    return unsubscribe;
  }, [navigate]);

  /**
   * Handle install button click
   */
  const handleInstall = async () => {
    setInstallError(null);
    setIsInstalling(true);
    
    try {
      const outcome = await installService.promptInstall();
      console.log('[InstallationFlow] Install outcome:', outcome);
      
      if (outcome === 'accepted') {
        // The app will auto-redirect via the subscription
      } else {
        // User declined - show a message
        setInstallError('Installation was declined. You can try again.');
      }
    } catch (error) {
      console.error('[InstallationFlow] Install error:', error);
      setInstallError('Installation failed. Please try again.');
    } finally {
      setIsInstalling(false);
    }
  };

  // If already installed, redirect (handled by useEffect)
  if (state.isInstalled) {
    return null;
  }

  /**
   * Render appropriate UI based on state
   */
  const renderContent = () => {
    // 1. Installation in progress
    if (state.installationState === 'installing' || isInstalling) {
      return (
        <div style={styles.installingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.installingText}>Installing SyncPoint...</p>
          <p style={styles.installingSubtext}>Please wait while we set up your app</p>
        </div>
      );
    }

    // 2. Show automatic install button (Chromium browsers)
    if (state.shouldShowAutoInstall()) {
      return (
        <>
          <div style={styles.installButtonContainer}>
            <button
              onClick={handleInstall}
              style={styles.installButton}
              disabled={isInstalling}
            >
              {isInstalling ? 'Installing...' : '📲 Install SyncPoint'}
            </button>
            {installError && (
              <p style={styles.errorMessage}>{installError}</p>
            )}
            <p style={styles.helpText}>
              Install SyncPoint as an app for the best experience
            </p>
          </div>
          <div style={styles.divider}>
            <span style={styles.dividerText}>or</span>
          </div>
          <div style={styles.manualInstructions}>
            <p style={styles.manualHint}>
              Look for the install icon in your browser's address bar
            </p>
          </div>
        </>
      );
    }

    // 3. Show manual instructions (Safari/Firefox/Desktop)
    if (state.shouldShowManualInstructions()) {
      const instructions = installService.getInstallInstructions();
      return (
        <div style={styles.manualContainer}>
          <div style={styles.manualIcon}>{instructions.icon}</div>
          <p style={styles.manualTitle}>{instructions.title}</p>
          <ol style={styles.stepsList}>
            {instructions.steps.map((step, index) => (
              <li key={index} style={styles.stepItem}>
                {step}
              </li>
            ))}
          </ol>
          {installError && (
            <p style={styles.errorMessage}>{installError}</p>
          )}
          <p style={styles.manualFooter}>
            After installation, open SyncPoint from your home screen
          </p>
        </div>
      );
    }

    // 4. Waiting for beforeinstallprompt
    if (state.installationState === 'waiting' || state.isWaitingForPrompt) {
      return (
        <div style={styles.waitingContainer}>
          <div style={styles.waitingSpinner}></div>
          <p style={styles.waitingText}>Preparing installation...</p>
          <p style={styles.waitingSubtext}>
            Checking if your browser supports automatic installation
          </p>
          <div style={styles.waitingNote}>
            <p style={styles.waitingNoteText}>
              ℹ️ This may take a moment. We're waiting for your browser to be ready.
            </p>
          </div>
        </div>
      );
    }

    // 5. Fallback - installation unavailable
    return (
      <div style={styles.unavailableContainer}>
        <p style={styles.unavailableText}>
          Installation is not available on this browser.
        </p>
        <p style={styles.unavailableSubtext}>
          Please use Chrome, Edge, or Safari to install SyncPoint.
        </p>
        <p style={styles.unavailableHelp}>
          Learn more about PWA installation at{' '}
          <a 
            href="https://web.dev/installable-pwas/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={styles.link}
          >
            web.dev
          </a>
        </p>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <AppLogo size={72} />
          <h1 style={styles.title}>SyncPoint</h1>
          <p style={styles.subtitle}>
            Offline-first peer-to-peer payments
          </p>
        </div>

        {/* Installation Content */}
        <div style={styles.body}>
          {renderContent()}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Installation is required to use SyncPoint
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
    padding: '24px',
  },
  content: {
    width: '100%',
    maxWidth: '440px',
    background: '#FFFFFF',
    borderRadius: '24px',
    padding: '40px 24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    textAlign: 'center',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    marginTop: '16px',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6B7280',
    lineHeight: '1.6',
  },
  body: {
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #F3F4F6',
  },
  footerText: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: 0,
  },
  
  // Waiting state
  waitingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 0',
  },
  waitingSpinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #E5E7EB',
    borderTopColor: '#0F766E',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  waitingText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: '8px 0 4px 0',
  },
  waitingSubtext: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0,
  },
  waitingNote: {
    marginTop: '16px',
    padding: '12px 16px',
    background: '#F8FAFA',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  waitingNoteText: {
    fontSize: '13px',
    color: '#374151',
    margin: 0,
  },
  
  // Install button state
  installButtonContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  installButton: {
    width: '100%',
    padding: '16px',
    background: '#0F766E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    ':hover': {
      background: '#0D6B64',
      transform: 'translateY(-1px)',
    },
    ':active': {
      transform: 'translateY(0px)',
    },
    ':disabled': {
      opacity: '0.7',
      cursor: 'not-allowed',
      transform: 'none',
    },
  },
  helpText: {
    fontSize: '13px',
    color: '#6B7280',
    margin: 0,
  },
  errorMessage: {
    fontSize: '14px',
    color: '#DC2626',
    margin: '4px 0',
    padding: '8px 12px',
    background: '#FEF2F2',
    borderRadius: '6px',
  },
  
  // Divider
  divider: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0',
  },
  dividerText: {
    padding: '0 16px',
    fontSize: '12px',
    color: '#9CA3AF',
    background: '#FFFFFF',
  },
  
  // Manual instructions
  manualContainer: {
    width: '100%',
    padding: '20px 0',
  },
  manualIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  manualTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px',
  },
  stepsList: {
    textAlign: 'left',
    paddingLeft: '20px',
    margin: '0 auto',
    maxWidth: '320px',
  },
  stepItem: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.8',
    marginBottom: '8px',
  },
  manualFooter: {
    marginTop: '20px',
    fontSize: '13px',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  manualHint: {
    fontSize: '13px',
    color: '#6B7280',
    padding: '12px',
    background: '#F8FAFA',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  
  // Installing state
  installingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 0',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #E5E7EB',
    borderTopColor: '#0F766E',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  installingText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: '8px 0 4px 0',
  },
  installingSubtext: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0,
  },
  
  // Unavailable state
  unavailableContainer: {
    padding: '20px 0',
  },
  unavailableText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#111827',
    marginBottom: '8px',
  },
  unavailableSubtext: {
    fontSize: '14px',
    color: '#6B7280',
    marginBottom: '12px',
  },
  unavailableHelp: {
    fontSize: '13px',
    color: '#6B7280',
  },
  link: {
    color: '#0F766E',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

// Add keyframes for animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default InstallationFlow;