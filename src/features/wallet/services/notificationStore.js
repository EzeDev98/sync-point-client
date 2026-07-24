/**
 * localStorage-backed notification log.
 *
 * The key, the JSON parsing and the 50-item cap were previously spread across
 * Dashboard (which read and rewrote the list) and FundWallet (which had its
 * own saveNotification that prepended and trimmed). Both now go through here.
 */

const STORAGE_KEY = 'notifications';
const MAX_NOTIFICATIONS = 50;

export function readNotifications() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeNotifications(notifications) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
}

/** Prepends a notification, filling in id, timestamp and unread state. */
export function addNotification({ type, title, desc, amount }) {
  const notification = {
    id: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    desc,
    amount,
    read: false,
    time: new Date().toISOString(),
  };

  const next = [notification, ...readNotifications()];
  writeNotifications(next);

  return notification;
}