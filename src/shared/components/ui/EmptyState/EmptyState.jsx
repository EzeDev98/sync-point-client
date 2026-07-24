import styles from './EmptyState.module.css';

/**
 * Centred placeholder for a list that is loading, failed, or has no rows.
 *
 * Dashboard rendered three of these as separate divs carrying an identical
 * inline `style={{ textAlign:'center', padding:'32px 0', fontSize:13 }}`
 * object that differed only in colour.
 */

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