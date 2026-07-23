import styles from './InfoBanner.module.css';

/**
 * Inline contextual message. Replaces .info-banner (17 uses) and the
 * one-off inline overrides that recoloured it for warning and error states,
 * e.g. style={{ background: '#FAEEDA', borderColor: '#F6C675', color: '#633806' }}.
 */

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