// Centred single-card page layout for form screens.
import { Card } from '@shared/components/ui';
import { ScreenContainer } from '@shared/components/layout';
import BackButton from '../BackButton/BackButton.jsx';
import styles from './FormScreen.module.css';

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
  onBack,
  backLabel,
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

  const backButton = onBack && (
      <BackButton onClick={onBack} label={backLabel} className={styles.backButton} />
    );

    if (scrollable) {
      return (
        <div className={styles.scrollableScreen}>
          {backButton}
          {card}
        </div>
      );
    }

    return (
      <ScreenContainer>
        {backButton}
        {card}
      </ScreenContainer>
    );
}

export default FormScreen;
