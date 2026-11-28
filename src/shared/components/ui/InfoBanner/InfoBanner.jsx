// Inline info, warning or error banner.
import styles from './InfoBanner.module.css';

const TONE_CLASS = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
};

function InfoBanner({ children, tone = 'info', className = '', ...rest }) {
  const classNames = [styles.banner, TONE_CLASS[tone] ?? TONE_CLASS.info, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      role={tone === 'error' ? 'alert' : 'status'}
      {...rest}
    >
      {children}
    </div>
  );
}

export default InfoBanner;
