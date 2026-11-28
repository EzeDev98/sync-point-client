// Local storage backed notification log.
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
