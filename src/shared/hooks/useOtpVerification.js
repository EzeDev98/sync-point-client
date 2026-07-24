import { useCallback, useState } from 'react';
import { useCountdown } from './useCountdown.js';
import { validateOtp } from '@shared/utils/validation';

/**
 * The OTP step of a reset flow: entry, validation, submission, and a
 * rate-limited resend.
 *
 * VerifyResetOtp and VerifyPinResetOtp were the same page twice — identical
 * state, identical digit filtering, identical cooldown handling, and the
 * same 429-with-remainingSeconds branch. Only the endpoints and the wording
 * differed, so those are the parameters.
 *
 * @param verify   async (otp) => void — throws to surface an error
 * @param resend   async () => void
 * @param cooldownSeconds  resend cooldown, also the initial lockout
 */
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
      // The server knows better than we do how long is left; honour it.
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