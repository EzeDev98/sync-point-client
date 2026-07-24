import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, OtpField, TextLink } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { useOtpVerification } from '@shared/hooks/useOtpVerification';
import { maskPhoneNumber } from '@shared/utils';
import { requestPinResetOtp, verifyPinResetOtp } from '@features/pin/api/pinApi';
import { readPersisted } from '@features/auth/services/sessionManager';
import { hasRequestedOtp, setPinResetToken } from '@features/pin/state/pinResetState';

function VerifyPinResetOtp() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = readPersisted('phoneNumber');

  // Reaching this step directly would bypass the unsynced-transaction gate
  // ForgotPin runs, so send the user back to the start of the flow.
  useEffect(() => {
    if (!hasRequestedOtp()) {
      navigate('/forgot-pin', { replace: true });
    }
  }, [navigate]);

  const otpState = useOtpVerification({
    verify: async (otp) => {
      if (isOffline) {
        navigate('/offline', { state: { returnTo: '/forgot-pin/verify' } });
        return;
      }

      const data = await verifyPinResetOtp(phoneNumber, otp);
      setPinResetToken(data.resetToken);
      navigate('/forgot-pin/reset');
    },
    resend: () => requestPinResetOtp(phoneNumber),
  });

  return (
    <FormScreen
      title="Verify your phone number"
      subtitle={
        <>
          Enter the verification code sent to <strong>{maskPhoneNumber(phoneNumber)}</strong>
        </>
      }
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

export default VerifyPinResetOtp;