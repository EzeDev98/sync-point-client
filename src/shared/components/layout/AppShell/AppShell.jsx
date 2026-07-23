import styles from './AppShell.module.css';

/**
 * The phone-width application frame: a max-width column with a sticky header
 * slot and a body that absorbs the remaining height.
 *
 * Replaces .sp-app (7 uses), .sp-header and .sp-body.
 */
function AppShell({ header, children, className = '' }) {
  return (
    <div className={[styles.shell, className].filter(Boolean).join(' ')}>
      {header && <header className={styles.header}>{header}</header>}
      <main className={styles.body}>{children}</main>
    </div>
  );
}

export default AppShell;