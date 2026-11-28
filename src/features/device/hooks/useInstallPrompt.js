// Manages the browser's PWA install prompt.
import { useEffect, useRef, useState } from 'react';

const PROMPT_TIMEOUT_MS = 30_000;

export const InstallPhase = {
  WAITING: 'waiting',
  READY: 'ready',
  INSTALLING: 'installing',
  MANUAL: 'manual',
  CLOSE: 'close',
};

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(() => window.__installPrompt ?? null);
  const [phase, setPhase] = useState(() => (prompt ? InstallPhase.READY : InstallPhase.WAITING));
  const [secondsLeft, setSecondsLeft] = useState(Math.round(PROMPT_TIMEOUT_MS / 1000));
  const [error, setError] = useState('');

  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    function clearTimers() {
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
    }

    if (window.__installPrompt) {
      window.__installPrompt = null;
      return undefined;
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setPrompt(e);
      window.__installPrompt = null;
      clearTimers();
      setPhase(InstallPhase.READY);
    }

    function handleAppInstalled() {
      clearTimers();
      setPhase(InstallPhase.CLOSE);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    timeoutRef.current = setTimeout(() => {
      clearInterval(countdownRef.current);
      setPhase(InstallPhase.MANUAL);
    }, PROMPT_TIMEOUT_MS);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)');

    function handleChange(e) {
      if (e.matches) setPhase(InstallPhase.CLOSE);
    }

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  async function install() {
    if (!prompt) return;

    setError('');
    setPhase(InstallPhase.INSTALLING);

    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);

      if (outcome === 'accepted') {
        setPhase(InstallPhase.CLOSE);
      } else {
        setPhase(InstallPhase.MANUAL);
        setError('Installation was cancelled. You can install manually using the steps below.');
      }
    } catch (err) {
      console.error('[useInstallPrompt] Install error:', err);
      setPhase(InstallPhase.MANUAL);
      setError('Something went wrong. Please follow the manual steps below.');
    }
  }

  function retry() {
    if (prompt) {
      setPhase(InstallPhase.READY);
    } else {
      window.location.reload();
    }
  }

  const progressPercent = (secondsLeft / (PROMPT_TIMEOUT_MS / 1000)) * 100;

  return {
    phase,
    setPhase,
    secondsLeft,
    progressPercent,
    error,
    install,
    retry,
    hasPrompt: Boolean(prompt),
  };
}
