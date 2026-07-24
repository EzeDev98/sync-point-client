import styles from './ReceiverCard.module.css';

/**
 * Counterparty summary: avatar, name, phone, verified badge.
 * Replaces .receiver-card and friends.
 */

function getInitials(name) {
  if (!name) return '??';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';

  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : parts[0][0].toUpperCase();
}

function ReceiverCard({ name, phone, badge = 'Verified' }) {
  return (
    <div className={styles.card}>
      <div className={styles.avatar} aria-hidden="true">
        {getInitials(name)}
      </div>

      <div className={styles.info}>
        <div className={styles.name}>{name}</div>
        <div className={styles.phone}>{phone}</div>
      </div>

      {badge && <span className={styles.badge}>{badge}</span>}
    </div>
  );
}

export default ReceiverCard;