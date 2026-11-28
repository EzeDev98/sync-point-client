// Verifies a new account's phone number by OTP.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  FormError,
  InfoBanner,
  Modal,
  OtpField,
  TextLink,
} from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { useOtpVerification } from '@shared/hooks/useOtpVerification';
import { maskPhoneNumber } from '@shared/utils';
import { resendAccountVerification, verifyAccountOtp } from '@features/auth/api/authApi';
import {
  clearAccountVerificationState,
  getPendingVerificationPhone,
  hasPendingVerification,
} from '@features/auth/state/accountVerificationState';
import styles from './VerifyAccount.module.css';

function VerifyAccount() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = getPendingVerificationPhone();

  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!hasPendingVerification()) {
      navigate('/register', { replace: true });
    }
  }, [navigate]);

  const otpState = useOtpVerification({
    verify: async (otp) => {
      if (isOffline) {
        navigate('/offline', { state: { returnTo: '/verify-account' } });
        return;
      }

      await verifyAccountOtp(phoneNumber, otp);
      setShowSuccess(true);
    },
    resend: () => resendAccountVerification(phoneNumber),
  });

  function handleContinue() {
    clearAccountVerificationState();
    navigate('/login', {
      state: { message: 'If you have verified your email, please sign in.' },
    });
  }

  function handleSuccessOk() {
    clearAccountVerificationState();
    setShowSuccess(false);
    navigate('/login', {
      state: { message: 'Account verified. Please sign in.' },
    });
  }

  return (
    <>
      <FormScreen
        title="Verify your account"
        subtitle={
          <>
            We sent a verification code to <strong>{maskPhoneNumber(phoneNumber)}</strong> and
            an activation link to your email.
          </>
        }
        onSubmit={otpState.handleSubmit}
        banner={
          isOffline && (
            <InfoBanner tone="warning">
              📡 You are offline. Connect to the internet to verify your account.
            </InfoBanner>
          )
        }
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
          Submit
        </Button>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <p className={styles.emailHint}>Already verified using the link in your email?</p>

        <Button type="button" variant="secondary" onClick={handleContinue}>
          Continue
        </Button>
      </FormScreen>

      <Modal
        open={showSuccess}
        icon="✅"
        title="Account verified"
        dismissOnOverlayClick={false}
        dismissOnEscape={false}
        actions={<Button onClick={handleSuccessOk}>OK</Button>}
      >
        Your account has been successfully verified. You can now sign in.
      </Modal>
    </>
  );
}

export default VerifyAccount;
