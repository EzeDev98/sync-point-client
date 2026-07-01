// ============================================
// DEVICE COMPATIBILITY — SyncPoint
// Minimum supported: devices from 2016+
// ============================================


const REQUIRED_FEATURES = {
  indexedDB: () => !!window.indexedDB,
  serviceWorker: () => "serviceWorker" in navigator,
  fetch: () => typeof fetch !== "undefined",
  promise: () => typeof Promise !== "undefined",
  cryptoSubtle: () => !!(window.crypto && window.crypto.subtle),
  sessionStorage: () => {
    try {
      sessionStorage.setItem("test", "1");
      sessionStorage.removeItem("test");
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
      os: "android",
      version: parseFloat(androidMatch[1]),
      name: `Android ${androidMatch[1]}`,
    };
  }

  const iosMatch = userAgent.match(/OS\s([0-9_]+)/);
  if (iosMatch && (userAgent.includes("iPhone") || userAgent.includes("iPad"))) {
    const version = parseFloat(iosMatch[1].replace(/_/g, "."));
    return {
      os: "ios",
      version,
      name: `iOS ${iosMatch[1].replace(/_/g, ".")}`,
    };
  }

  if (userAgent.includes("Windows") || userAgent.includes("Mac") || userAgent.includes("Linux")) {
    return { os: "desktop", version: 999, name: "Desktop" };
  }

  return { os: "unknown", version: 0, name: "Unknown" };
}

function getMissingFeatures() {
  return Object.entries(REQUIRED_FEATURES)
    .filter(([, check]) => !check())
    .map(([name]) => name);
}

export function checkDeviceCompatibility() {
  const device = getDeviceInfo();
  const missingFeatures = getMissingFeatures();

  let osCompatible = true;
  let osMessage = null;

  if (device.os === "android" && device.version < MIN_OS_VERSIONS.android) {
    osCompatible = false;
    osMessage = `Your Android version (${device.name}) is too old. SyncPoint requires Android 7.0 or later (released 2016).`;
  }

  if (device.os === "ios" && device.version < MIN_OS_VERSIONS.ios) {
    osCompatible = false;
    osMessage = `Your iOS version (${device.name}) is too old. SyncPoint requires iOS 10 or later (released 2016).`;
  }

  const isCompatible = osCompatible && missingFeatures.length === 0;

  return {
    isCompatible,
    device,
    osCompatible,
    osMessage,
    missingFeatures,
    message: !isCompatible ? osMessage || `Your device is missing required features: ${missingFeatures.join(", ")}. Please update your browser or device.` : null,
  };
}

export function isPWAInstalled() {

  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;

  if (localStorage.getItem("pwa_installed") === "true") return true;

  return false;
}