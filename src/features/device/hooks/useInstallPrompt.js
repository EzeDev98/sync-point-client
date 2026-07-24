import { useEffect, useRef, useState } from 'react';

/**
 * Owns the browser's install prompt lifecycle.
 *
 * The `beforeinstallprompt` event may fire before this mounts, so main.jsx
 * stashes it on window.__installPrompt; this hook picks up either the stashed
 * event or a later one. A timeout falls back to manual instructions when the
 * event never arrives at all — Safari, for instance, never fires it.
 *
 * Phases: waiting → ready → installing → close, or → manual on timeout,
 * refusal or error.
 */

const PROMPT_TIMEOUT_MS = 30_000;

export const InstallPhase = {
  WAITING: 'waiting',
  READY: 'ready',
  INSTALLING: 'installing',
  MANUAL: 'manual',
  CLOSE: 'close',
};

export function useInstallPrompt() {
  const [phase, setPhase] = useState(InstallPhase.WAITING);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(PROMPT_TIMEOUT_MS / 1000));
  const [error, setError] = useState('');

  const promptRef = useRef(null);
  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    function clearTimers() {
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
    }

    // The event may have fired before this component existed.
    if (window.__installPrompt) {
      promptRef.current = window.__installPrompt;
      window.__installPrompt = null;
      setPhase(InstallPhase.READY);
      return undefined;
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      promptRef.current = e;
      window.__installPrompt = null;
      clearTimers();
      setPhase(InstallPhase.READY);
    }

    // Installation finished outside our custom flow — hand off rather than
    // navigating, so the user opens the installed app instead of this tab.
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

  // Catches installs completed through browser UI while this page is open,
  // including the Android mini-infobar, which fires no appinstalled event.
  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)');

    function handleChange(e) {
      if (e.matches) setPhase(InstallPhase.CLOSE);
    }

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) return;

    setError('');
    setPhase(InstallPhase.INSTALLING);

    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      promptRef.current = null;

      if (outcome === 'accepted') {
        // The browser has taken over. Hand off immediately rather than
        // waiting in this tab for an install we cannot observe.
        setPhase(InstallPhase.CLOSE);
      } else {
        // A consumed prompt cannot be re-shown this session.
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
    if (promptRef.current) {
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
    hasPrompt: Boolean(promptRef.current),
  };
}