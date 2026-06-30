import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { hasResumableSession } from '../services/sessionUtils';

/**
 * AuthGuard - Route guard that requires authentication
 * 
 * Checks if there's a resumable session (refresh token exists)
 * This is the same check used elsewhere in the app for session validation
 */
function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Use the existing hasResumableSession function
    const hasSession = hasResumableSession();
    setIsAuthenticated(hasSession);
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

const styles = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #E5E7EB',
    borderTopColor: '#0F766E',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#6B7280',
  },
};

export default AuthGuard;