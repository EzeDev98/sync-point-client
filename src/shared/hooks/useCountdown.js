import { useCallback, useEffect, useState } from 'react';

/**
 * Counts down to zero, one second at a time.
 *
 * The OTP screens each carried their own copy of this interval logic for
 * their resend cooldown. `restart` accepts a duration so a server-supplied
 * 429 retry window can override the default.
 */
export function useCountdown(initialSeconds = 0) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;

    const timerId = setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [secondsLeft]);

  const restart = useCallback((seconds = initialSeconds) => {
    setSecondsLeft(seconds);
  }, [initialSeconds]);

  return { secondsLeft, restart, isComplete: secondsLeft <= 0 };
}