// Notification bell with its dropdown list.
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatShortDateTime } from '@shared/utils';
import styles from './NotificationBell.module.css';

const NOTIFICATION_STYLE = {
  fund: { icon: '💳', tone: 'success' },
  transfer: { icon: '🏦', tone: 'info' },
  sync: { icon: '🔄', tone: 'info' },
  payment: { icon: '↙', tone: 'success' },
  warning: { icon: '⚠️', tone: 'warning' },
  error: { icon: '❌', tone: 'error' },
};

const FALLBACK_STYLE = { icon: '🔔', tone: 'info' };

function NotificationBell({ notifications = [], unreadCount = 0, onMarkAsRead, onMarkAllAsRead }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && <span className={styles.unreadDot} aria-hidden="true" />}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>
              Notifications
              {unreadCount > 0 && <span className={styles.count}>{unreadCount}</span>}
            </span>

            {unreadCount > 0 && (
              <button type="button" className={styles.markAllButton} onClick={onMarkAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>No notifications yet</div>
            ) : (
              notifications.map((notification) => {
                const { icon, tone } =
                  NOTIFICATION_STYLE[notification.type] ?? FALLBACK_STYLE;

                return (
                <button
                  type="button"
                  key={notification.id}
                  className={[styles.item, notification.read ? '' : styles.itemUnread]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <span className={[styles.itemIcon, styles[tone]].join(' ')} aria-hidden="true">
                    {icon}
                  </span>

                  <span className={styles.itemContent}>
                    <span className={styles.itemTitle}>{notification.title}</span>
                    <span className={styles.itemDesc}>{notification.desc}</span>
                    <span className={styles.itemTime}>
                      {formatShortDateTime(notification.time)}
                    </span>
                  </span>

                  {!notification.read && <span className={styles.itemDot} aria-hidden="true" />}
                </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
