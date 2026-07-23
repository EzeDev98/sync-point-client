import { Card } from '@shared/components/ui';
import { ScreenContainer } from '@shared/components/layout';
import styles from './FormScreen.module.css';

/**
 * Centred single-card page scaffold: title, subtitle, form body, footer links.
 *
 * Replaces the block copy-pasted into all twelve auth and PIN pages —
 * .auth-page > .auth-card > .auth-header > .auth-title + .auth-subtitle,
 * then .auth-form and .auth-links.
 *
 * Lives in shared/ rather than in either feature because both the auth and
 * pin features use it, and a feature must never import another feature's
 * internals.
 *
 * `scrollable` switches to the taller top-aligned variant Register needs
 * (previously the separate .auth-page--register rule), so the two cannot
 * drift apart again.
 */
function FormScreen({
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

export default FormScreen;