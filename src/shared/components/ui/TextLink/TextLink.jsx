// Inline text link or button.
import { Link } from 'react-router-dom';
import styles from './TextLink.module.css';

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
