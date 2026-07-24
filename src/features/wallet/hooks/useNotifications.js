import { useCallback, useState } from 'react';
import {
  readNotifications,
  writeNotifications,
} from '@features/wallet/services/notificationStore';

/**
 * Notification list backed by the notification store.
 *
 * Previously a lazy useState initialiser plus two near-identical handlers
 * inside Dashboard, each writing to localStorage by hand.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState(readNotifications);

  const update = useCallback((transform) => {
    setNotifications((current) => {
      const next = transform(current);
      writeNotifications(next);
      return next;
    });
  }, []);

  const markAsRead = useCallback(
    (id) => update((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [update]
  );

  const markAllAsRead = useCallback(
    () => update((current) => current.map((n) => ({ ...n, read: true }))),
    [update]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}