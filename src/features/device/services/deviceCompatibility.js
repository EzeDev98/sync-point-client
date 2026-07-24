/**
 * Device and browser capability checks.
 *
 * SyncPoint needs a specific set of browser APIs to work at all — without
 * IndexedDB there is nowhere to store transactions, and without Web Crypto
 * they cannot be encrypted. A device missing either cannot run the app in a
 * degraded mode, so it is blocked outright at DeviceGate rather than failing
 * confusingly later.
 *
 * Minimum supported: devices from 2016 onward.
 */

/** Each entry returns true when the capability is present. */
const REQUIRED_FEATURES = {
  indexedDB: () => Boolean(window.indexedDB),
  serviceWorker: () => 'serviceWorker' in navigator,
  fetch: () => typeof fetch !== 'undefined',
  promise: () => typeof Promise !== 'undefined',
  cryptoSubtle: () => Boolean(window.crypto && window.crypto.subtle),
  sessionStorage: () => {
    // Presence is not enough — Safari private browsing exposes the API but
    // throws on write, so the only reliable check is to attempt one.
    try {
      sessionStorage.setItem('__probe', '1');
      sessionStorage.removeItem('__probe');
      return true;
    } catch {
      return false;
    }
  },
};

const MIN_OS_VERSIONS = {
  android: 7,
  ios: 10,
};

function getDeviceInfo() {
  const userAgent = navigator.userAgent;

  const androidMatch = userAgent.match(/Android\s([0-9.]+)/);
  if (androidMatch) {
    return {
      os: 'android',
      version: parseFloat(androidMatch[1]),
      name: `Android ${androidMatch[1]}`,
    };
  }

  const iosMatch = userAgent.match(/OS\s([0-9_]+)/);
  if (iosMatch && (userAgent.includes('iPhone') || userAgent.includes('iPad'))) {
    return {
      os: 'ios',
      version: parseFloat(iosMatch[1].replace(/_/g, '.')),
      name: `iOS ${iosMatch[1].replace(/_/g, '.')}`,
    };
  }

  if (
    userAgent.includes('Windows') ||
    userAgent.includes('Mac') ||
    userAgent.includes('Linux')
  ) {
    // Desktop is only used for development; the version check is bypassed.
    return { os: 'desktop', version: 999, name: 'Desktop' };
  }

  return { os: 'unknown', version: 0, name: 'Unknown' };
}

function getMissingFeatures() {
  return Object.entries(REQUIRED_FEATURES)
    .filter(([, isSupported]) => !isSupported())
    .map(([name]) => name);
}

export function checkDeviceCompatibility() {
  const device = getDeviceInfo();
  const missingFeatures = getMissingFeatures();

  let osCompatible = true;
  let osMessage = null;

  if (device.os === 'android' && device.version < MIN_OS_VERSIONS.android) {
    osCompatible = false;
    osMessage = `Your Android version (${device.name}) is too old. SyncPoint requires Android 7.0 or later.`;
  }

  if (device.os === 'ios' && device.version < MIN_OS_VERSIONS.ios) {
    osCompatible = false;
    osMessage = `Your iOS version (${device.name}) is too old. SyncPoint requires iOS 10 or later.`;
  }

  const isCompatible = osCompatible && missingFeatures.length === 0;

  return {
    isCompatible,
    device,
    osCompatible,
    osMessage,
    missingFeatures,
    message: isCompatible
      ? null
      : osMessage ||
        `Your device is missing required features: ${missingFeatures.join(', ')}. Please update your browser or device.`,
  };
}

/**
 * True when running as an installed PWA rather than in a browser tab.
 *
 * Three checks because no single one covers every platform: the standard
 * display-mode query, Safari's non-standard navigator.standalone, and
 * fullscreen for launchers that use it instead of standalone.
 */
export function isPWAInstalled() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;

  return false;
}