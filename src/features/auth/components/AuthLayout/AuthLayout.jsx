import { Card } from '@shared/components/ui';
import { ScreenContainer } from '@shared/components/layout';
import styles from './AuthLayout.module.css';

/**
 * The page scaffold shared by every auth screen: centred card, title,
 * subtitle, form body, footer links.
 *
 * Replaces the block that was copy-pasted into all six auth pages —
 * .auth-page > .auth-card > .auth-header > .auth-title + .auth-subtitle,
 * then .auth-form and .auth-links.
 *
 * `scrollable` switches to the taller top-aligned variant Register needs
 * (previously the separate .auth-page--register rule), so the two never drift
 * apart again.
 */
function AuthLayout({
  title,
  subtitle,
  children,
  header,
  footer,
  banner,
  wide = false,
  scrollable = false,
  onSubmit,
}) {
  const card = (
    <Card wide={wide}>
      {(title || subtitle || header) && (
        <div className={styles.header}>
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {header}
        </div>
      )}

      {banner && <div className={styles.banner}>{banner}</div>}

      {onSubmit ? (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {children}
        </form>
      ) : (
        <div className={styles.form}>{children}</div>
      )}

      {footer && <div className={styles.footer}>{footer}</div>}
    </Card>
  );

  if (scrollable) {
    return <div className={styles.scrollableScreen}>{card}</div>;
  }

  return <ScreenContainer>{card}</ScreenContainer>;
}

export default AuthLayout;