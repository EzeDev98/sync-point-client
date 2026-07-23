import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, TextField, TextLink } from '@shared/components/ui';
import { useCountdown } from '@shared/hooks/useCountdown';
import { useNetwork } from '@shared/hooks/useNetwork';
import { requestPasswordResetOtp, verifyPasswordResetOtp } from '@features/auth/api/authApi';
import {
  getPhoneNumber,
  hasRequestedOtp,
  maskPhoneNumber,
  setResetToken,
} from '@features/auth/state/passwordResetState';
import AuthLayout from '@features/auth/components/AuthLayout/AuthLayout.jsx';
import { OTP_LENGTH, validateOtp } from '@features/auth/utils/authValidation';
import styles from './VerifyResetOtp.module.css';

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyResetOtp() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = getPhoneNumber();

  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { secondsLeft, restart } = useCountdown(RESEND_COOLDOWN_SECONDS);

  // Reaching this step without having requested a code is not a valid state.
  useEffect(() => {
    if (!hasRequestedOtp()) {
      navigate('/forgot-password', { replace: true });
    }
  }, [navigate]);

  function handleChange(e) {
    setOtp(e.target.value.replace(/\D/g, ''));
    if (errors.otp) setErrors((prev) => ({ ...prev, otp: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/forgot-password/verify' } });
      return;
    }

    const otpError = validateOtp(otp);
    if (otpError) {
      setErrors({ otp: otpError });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const data = await verifyPasswordResetOtp(phoneNumber, otp);
      setResetToken(data.resetToken);
      navigate('/forgot-password/reset');
    } catch (err) {
      setErrors({ general: err.message || 'The verification code is invalid.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || isResending) return;

    setIsResending(true);
    setErrors({});

    try {
      await requestPasswordResetOtp(phoneNumber);
      restart(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err.status === 429 && err.remainingSeconds) {
        restart(err.remainingSeconds);
      }
      setErrors({ general: err.message || 'Could not resend code. Please try again.' });
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthLayout
      title="Verify your phone number"
      subtitle={
        <>
          Enter the verification code sent to <strong>{maskPhoneNumber(phoneNumber)}</strong>
        </>
      }
      onSubmit={handleSubmit}
      footer={
        secondsLeft > 0 ? (
          <p>Resend code in {secondsLeft}s</p>
        ) : (
          <TextLink onClick={handleResend} disabled={isResending}>
            {isResending ? 'Resending...' : 'Resend code'}
          </TextLink>
        )
      }
    >
      <TextField
        label="Verification code"
        name="otp"
        placeholder="• • • • • •"
        value={otp}
        onChange={handleChange}
        error={errors.otp}
        inputMode="numeric"
        maxLength={OTP_LENGTH}
        autoComplete="one-time-code"
        className={styles.otpField}
      />

      <FormError>{errors.general}</FormError>

      <Button type="submit" loading={isSubmitting} loadingLabel="Verifying...">
        Verify OTP
      </Button>
    </AuthLayout>
  );
}

export default VerifyResetOtp;