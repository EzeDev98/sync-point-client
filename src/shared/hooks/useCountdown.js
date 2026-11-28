// Counts down to zero one second at a time.
import { useCallback, useEffect, useState } from 'react';

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

  const stop = useCallback(() => setSecondsLeft(0), []);

  const formatted = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
    secondsLeft % 60
  ).padStart(2, '0')}`;

  return { secondsLeft, formatted, restart, stop, isComplete: secondsLeft <= 0 };
}
