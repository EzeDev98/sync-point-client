// Verifies the password reset OTP.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, OtpField, TextLink } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { useOtpVerification } from '@shared/hooks/useOtpVerification';
import { maskPhoneNumber } from '@shared/utils';
import { requestPasswordResetOtp, verifyPasswordResetOtp } from '@features/auth/api/authApi';
import {
  getPhoneNumber,
  hasRequestedOtp,
  setResetToken,
} from '@features/auth/state/passwordResetState';

function VerifyResetOtp() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = getPhoneNumber();

  useEffect(() => {
    if (!hasRequestedOtp()) {
      navigate('/forgot-password', { replace: true });
    }
  }, [navigate]);

  const otpState = useOtpVerification({
    verify: async (otp) => {
      if (isOffline) {
        navigate('/offline', { state: { returnTo: '/forgot-password/verify' } });
        return;
      }

      const data = await verifyPasswordResetOtp(phoneNumber, otp);
      setResetToken(data.resetToken);
      navigate('/forgot-password/reset');
    },
    resend: () => requestPasswordResetOtp(phoneNumber),
  });

  return (
    <FormScreen
      title="Verify your phone number"
      subtitle={
        <>
          Enter the verification code sent to <strong>{maskPhoneNumber(phoneNumber)}</strong>
        </>
      }
      onBack={() => navigate('/forgot-password')} backLabel="Back"
      onSubmit={otpState.handleSubmit}
      footer={
        otpState.secondsLeft > 0 ? (
          <p>Resend code in {otpState.secondsLeft}s</p>
        ) : (
          <TextLink onClick={otpState.handleResend} disabled={otpState.isResending}>
            {otpState.isResending ? 'Resending...' : 'Resend code'}
          </TextLink>
        )
      }
    >
      <OtpField
        value={otpState.otp}
        onChange={otpState.handleChange}
        error={otpState.errors.otp}
      />

      <FormError>{otpState.errors.general}</FormError>

      <Button type="submit" loading={otpState.isSubmitting} loadingLabel="Verifying...">
        Verify OTP
      </Button>
    </FormScreen>
  );
}

export default VerifyResetOtp;
