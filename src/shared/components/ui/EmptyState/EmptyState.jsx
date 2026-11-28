// Placeholder for a list that is loading, failed or empty.
import styles from './EmptyState.module.css';

const TONE_CLASS = {
  muted: styles.muted,
  error: styles.error,
};

function EmptyState({ children, tone = 'muted', className = '' }) {
  const classNames = [styles.state, TONE_CLASS[tone] ?? TONE_CLASS.muted, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export default EmptyState;
