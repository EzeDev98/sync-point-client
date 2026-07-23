import { Link } from 'react-router-dom';
import styles from './TextLink.module.css';

/**
 * Inline text action. Replaces .auth-link (8 uses).
 *
 * The old code put this class on both <Link> and <button>, and every button
 * instance carried the same inline reset
 * (`style={{ background:'none', border:'none', padding:0, font:'inherit' }}`)
 * to make a button look like an anchor. That reset now lives in the
 * stylesheet: pass `to` for navigation or `onClick` for an action, and the
 * right element is rendered either way.
 */
function TextLink({ to, onClick, children, disabled = false, type = 'button', className = '', ...rest }) {
  const classNames = [styles.link, className].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link to={to} className={classNames} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classNames} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export default TextLink;