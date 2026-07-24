import styles from './AppShell.module.css';

/**
 * The phone-width application frame: a sticky header slot, a body that
 * absorbs the remaining height, and a footer pinned to the bottom.
 *
 * Replaces .sp-app, .sp-header and .sp-body.
 *
 * The footer is a sibling of <main>, not a child of it — that is what makes
 * it sit at the bottom of the viewport on a short page rather than directly
 * beneath the content. <main> carries flex: 1 and grows to fill whatever is
 * left, pushing the footer down.
 */
function AppShell({ header, footer, children, className = '' }) {
  return (
    <div className={[styles.shell, className].filter(Boolean).join(' ')}>
      {header && <header className={styles.header}>{header}</header>}

      <main className={styles.body}>{children}</main>

      {footer && (
        <>
          <div className={styles.divider} aria-hidden="true" />
          <footer className={styles.footer}>{footer}</footer>
        </>
      )}
    </div>
  );
}

export default AppShell;