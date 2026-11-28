// OTP entry, submission and rate-limited resend for the reset flows.
import { useCallback, useState } from 'react';
import { useCountdown } from './useCountdown.js';
import { validateOtp } from '@shared/utils/validation';

export function useOtpVerification({ verify, resend, cooldownSeconds = 60 }) {
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { secondsLeft, restart } = useCountdown(cooldownSeconds);

  const handleChange = useCallback((e) => {
    setOtp(e.target.value.replace(/\D/g, ''));
    setErrors((current) => (current.otp ? { ...current, otp: '' } : current));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      const otpError = validateOtp(otp);
      if (otpError) {
        setErrors({ otp: otpError });
        return;
      }

      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        await verify(otp);
      } catch (err) {
        setErrors({ general: err.message || 'The verification code is invalid.' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [otp, isSubmitting, verify]
  );

  const handleResend = useCallback(async () => {
    if (secondsLeft > 0 || isResending) return;

    setIsResending(true);
    setErrors({});

    try {
      await resend();
      restart(cooldownSeconds);
    } catch (err) {
      if (err.status === 429 && err.remainingSeconds) {
        restart(err.remainingSeconds);
      }
      setErrors({ general: err.message || 'Could not resend code. Please try again.' });
    } finally {
      setIsResending(false);
    }
  }, [secondsLeft, isResending, resend, restart, cooldownSeconds]);

  return {
    otp,
    errors,
    isSubmitting,
    isResending,
    secondsLeft,
    handleChange,
    handleSubmit,
    handleResend,
  };
}
