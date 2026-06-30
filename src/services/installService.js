/**
 * InstallService - Singleton service for managing PWA installation
 * 
 * This is the ONLY owner of the beforeinstallprompt event.
 * No other file should listen for this event.
 */

class InstallService {
  constructor() {
    // Singleton pattern
    if (InstallService._instance) {
      return InstallService._instance;
    }
    InstallService._instance = this;

    // State
    this.deferredPrompt = null;
    this.isInstalled = this.checkIfInstalled();
    this.isInstallAvailable = false;
    this.isWaitingForPrompt = false;
    this.installationState = 'idle'; // idle | waiting | ready | installing | installed | unavailable
    
    // Subscribers
    this.subscribers = new Set();
    
    // Platform detection
    this.platform = this.detectPlatform();
    
    // Initialize
    this.setupBeforeInstallPrompt();
    this.setupAppInstalledHandler();
    this.setupVisibilityHandler();
  }

  /**
   * Detect the current platform/browser
   */
  detectPlatform() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    
    // iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    if (isIOS) {
      // Check if it's already a PWA on iOS
      const isInStandalone = window.navigator.standalone === true;
      return { 
        type: 'ios', 
        isInStandalone,
        supportsPrompt: false,
        canInstall: !isInStandalone
      };
    }

    // Firefox
    const isFirefox = /Firefox/i.test(ua);
    if (isFirefox) {
      return { 
        type: 'firefox', 
        supportsPrompt: false,
        canInstall: !this.isInstalled
      };
    }

    // Chrome/Edge (Chromium-based)
    const isChromium = /Chrome|Edge|Chromium/i.test(ua);
    if (isChromium) {
      return { 
        type: 'chromium', 
        supportsPrompt: true,
        canInstall: !this.isInstalled
      };
    }

    // Generic desktop browser
    const isDesktop = !/Mobi|Android/i.test(ua);
    if (isDesktop) {
      return {
        type: 'desktop',
        supportsPrompt: false, // Most desktop browsers don't support beforeinstallprompt
        canInstall: !this.isInstalled
      };
    }

    // Unknown
    return {
      type: 'unknown',
      supportsPrompt: false,
      canInstall: !this.isInstalled
    };
  }

  /**
   * Check if app is already installed as PWA
   */
  checkIfInstalled() {
    // iOS Safari standalone mode
    if (window.navigator.standalone === true) {
      return true;
    }

    // Chrome/Android display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Check if we're in a PWA via window context
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }

    return false;
  }

  /**
   * Setup the single beforeinstallprompt listener
   */
  setupBeforeInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      
      // Store the event for later use
      this.deferredPrompt = event;
      this.isInstallAvailable = true;
      this.isWaitingForPrompt = false;
      this.installationState = 'ready';
      
      console.log('[InstallService] beforeinstallprompt received');
      this.notifySubscribers();
    });

    // Start waiting for the prompt
    this.isWaitingForPrompt = true;
    this.installationState = 'waiting';
  }

  /**
   * Setup appinstalled event listener
   */
  setupAppInstalledHandler() {
    window.addEventListener('appinstalled', () => {
      console.log('[InstallService] App installed');
      this.deferredPrompt = null;
      this.isInstallAvailable = false;
      this.installationState = 'installed';
      
      // Re-check installation status
      setTimeout(() => {
        this.isInstalled = this.checkIfInstalled();
        this.notifySubscribers();
      }, 500);
    });
  }

  /**
   * Setup visibility change handler to detect installs done via browser UI
   */
  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const wasInstalled = this.isInstalled;
        this.isInstalled = this.checkIfInstalled();
        
        if (!wasInstalled && this.isInstalled) {
          console.log('[InstallService] Installation detected via visibility change');
          this.deferredPrompt = null;
          this.isInstallAvailable = false;
          this.installationState = 'installed';
          this.notifySubscribers();
        }
      }
    });
  }

  /**
   * Subscribe to installation state changes
   */
  subscribe(listener) {
    this.subscribers.add(listener);
    // Immediately notify with current state
    listener(this.getState());
    return () => this.unsubscribe(listener);
  }

  /**
   * Unsubscribe from installation state changes
   */
  unsubscribe(listener) {
    this.subscribers.delete(listener);
  }

  /**
   * Notify all subscribers of state changes
   */
  notifySubscribers() {
    const state = this.getState();
    this.subscribers.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[InstallService] Subscriber error:', error);
      }
    });
  }

  /**
   * Get the current state object
   */
  getState() {
    return {
      isInstalled: this.isInstalled,
      isInstallAvailable: this.isInstallAvailable,
      isWaitingForPrompt: this.isWaitingForPrompt,
      installationState: this.installationState,
      platform: this.platform,
      deferredPrompt: this.deferredPrompt,
      canInstall: this.platform.canInstall && !this.isInstalled,
      supportsPrompt: this.platform.supportsPrompt,
    };
  }

  /**
   * Get the deferred prompt for installation
   */
  getDeferredPrompt() {
    return this.deferredPrompt;
  }

  /**
   * Trigger the installation prompt
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      throw new Error('No deferred prompt available');
    }

    this.installationState = 'installing';
    this.notifySubscribers();

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user's choice
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('[InstallService] User choice:', outcome);
      
      // Clear the deferred prompt after use
      this.deferredPrompt = null;
      this.isInstallAvailable = false;
      
      if (outcome === 'accepted') {
        // Wait a moment for the app to actually install
        setTimeout(() => {
          this.isInstalled = this.checkIfInstalled();
          if (this.isInstalled) {
            this.installationState = 'installed';
          } else {
            this.installationState = 'ready';
            this.isInstallAvailable = true;
          }
          this.notifySubscribers();
        }, 1000);
      } else {
        // User declined - we can try again later
        this.installationState = 'ready';
        // The prompt event is consumed, we need to wait for a new one
        // which might not come again in the same session
        this.isInstallAvailable = false;
        this.isWaitingForPrompt = true;
        this.notifySubscribers();
      }
      
      return outcome;
    } catch (error) {
      console.error('[InstallService] Installation error:', error);
      this.installationState = 'ready';
      this.notifySubscribers();
      throw error;
    }
  }

  /**
   * Check if the app is installed
   */
  isPWAInstalled() {
    return this.isInstalled;
  }

  /**
   * Check if installation is available
   */
  isInstallAvailable() {
    return this.isInstallAvailable || this.deferredPrompt !== null;
  }

  /**
   * Get platform-specific installation instructions
   */
  getInstallInstructions() {
    const platform = this.platform.type;
    
    switch (platform) {
      case 'ios':
        return {
          title: 'Add to Home Screen',
          steps: [
            'Tap the Share button in Safari',
            'Scroll down and tap "Add to Home Screen"',
            'Tap "Add" in the top right',
            'Open SyncPoint from your Home Screen'
          ],
          icon: '📱'
        };
      
      case 'firefox':
        return {
          title: 'Install SyncPoint',
          steps: [
            'Click the menu button (three lines) in the top right',
            'Click "Add to Home Screen" or "Install"',
            'Follow the prompts to complete installation'
          ],
          icon: '🦊'
        };
      
      case 'desktop':
        return {
          title: 'Install SyncPoint',
          steps: [
            'Click the install icon in your browser\'s address bar',
            'Look for a "+" or install button in the URL bar',
            'Or click "Install" from the browser menu'
          ],
          icon: '💻'
        };
      
      default:
        return {
          title: 'Installation Instructions',
          steps: [
            'Look for an "Install" or "Add to Home Screen" option in your browser',
            'Follow the browser\'s prompts to install the app',
            'Open SyncPoint from your Home Screen or desktop'
          ],
          icon: '📲'
        };
    }
  }

  /**
   * Check if we should show automatic install prompt
   */
  shouldShowAutoInstall() {
    return this.platform.supportsPrompt && 
           !this.isInstalled && 
           this.deferredPrompt !== null;
  }

  /**
   * Check if we should show manual instructions
   */
  shouldShowManualInstructions() {
    return !this.platform.supportsPrompt && 
           !this.isInstalled && 
           this.platform.canInstall;
  }
}

// Create singleton instance
const installService = new InstallService();

// Expose for debugging (remove in production)
if (typeof window !== 'undefined') {
  window.__installService = installService;
}

export default installService;