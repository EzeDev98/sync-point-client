import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, TextField, TextLink } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useCountdown } from '@shared/hooks/useCountdown';
import { useNetwork } from '@shared/hooks/useNetwork';
import { maskPhoneNumber } from '@shared/utils/maskPhoneNumber';
import { requestPinResetOtp, verifyPinResetOtp } from '@features/pin/api/pinApi';
import { readPersisted } from '@features/auth/services/sessionManager';
import { hasRequestedOtp, setPinResetToken } from '@features/pin/state/pinResetState';
import { OTP_LENGTH, validateOtp } from '@features/pin/utils/pinValidation';
import styles from './VerifyPinResetOtp.module.css';

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyPinResetOtp() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = readPersisted('phoneNumber');

  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { secondsLeft, restart } = useCountdown(RESEND_COOLDOWN_SECONDS);

  // Reaching this step directly would bypass the unsynced-transaction gate
  // that ForgotPin runs, so send the user back to the start of the flow.
  useEffect(() => {
    if (!hasRequestedOtp()) {
      navigate('/forgot-pin', { replace: true });
    }
  }, [navigate]);

  function handleChange(e) {
    setOtp(e.target.value.replace(/\D/g, ''));
    if (errors.otp) setErrors((prev) => ({ ...prev, otp: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/forgot-pin/verify' } });
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
      const data = await verifyPinResetOtp(phoneNumber, otp);
      setPinResetToken(data.resetToken);
      navigate('/forgot-pin/reset');
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
      await requestPinResetOtp(phoneNumber);
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
    <FormScreen
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
    </FormScreen>
  );
}

export default VerifyPinResetOtp;