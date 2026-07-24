import { useEffect, useState } from 'react';
import { Routes, useLocation } from 'react-router-dom';
import styles from './AnimatedRoutes.module.css';

/**
 * Cross-fades between routes by holding the outgoing location on screen for
 * the length of the exit transition before swapping in the new one.
 */

/** Must match the exit transition duration in AnimatedRoutes.module.css. */
const EXIT_DURATION_MS = 160;

function AnimatedRoutes({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState('enter');

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return undefined;

    setStage('exit');

    const timeoutId = setTimeout(() => {
      setDisplayLocation(location);
      setStage('enter');
    }, EXIT_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [location, displayLocation]);

  return (
    <div className={[styles.wrapper, stage === 'exit' ? styles.exit : styles.enter].join(' ')}>
      <Routes location={displayLocation}>{children}</Routes>
    </div>
  );
}

export default AnimatedRoutes;