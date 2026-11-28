// Cross-fades between routes by keeping the outgoing screen during the exit transition.
import { useEffect, useState } from 'react';
import { Routes, useLocation } from 'react-router-dom';
import styles from './AnimatedRoutes.module.css';

const EXIT_DURATION_MS = 160;

function AnimatedRoutes({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const isLeaving = location.pathname !== displayLocation.pathname;

  useEffect(() => {
    if (!isLeaving) return undefined;

    const timeoutId = setTimeout(() => setDisplayLocation(location), EXIT_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [isLeaving, location]);

  return (
    <div className={[styles.wrapper, isLeaving ? styles.exit : styles.enter].join(' ')}>
      <Routes location={displayLocation}>{children}</Routes>
    </div>
  );
}

export default AnimatedRoutes;
