// Phone-width app frame with header, body and footer slots.
import styles from './AppShell.module.css';

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
