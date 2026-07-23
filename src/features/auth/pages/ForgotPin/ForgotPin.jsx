import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, InfoBanner } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { maskPhoneNumber } from '@shared/utils/maskPhoneNumber';
import { requestPinResetOtp } from '@features/pin/api/pinApi';
import { readPersisted } from '@features/auth/services/sessionManager';
import { getPendingCount } from '@core/db/transactionRepository';
import { markOtpRequested } from '@features/pin/state/pinResetState';
import styles from './ForgotPin.module.css';

/** What the unsynced-transaction gate decided. */
const GateState = {
  CHECKING: 'checking',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
  ALLOWED: 'allowed',
};

function ForgotPin() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const phoneNumber = readPersisted('phoneNumber');

  const [gate, setGate] = useState({ state: GateState.CHECKING, pendingCount: 0 });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A PIN reset must be blocked while unsynced offline transactions exist:
  // they were encrypted with the key derived from the PIN about to be
  // replaced, and once it is replaced they cannot be decrypted or synced —
  // permanently, not "retry later".
  //
  // Checked here rather than only on the "Forgot PIN?" link so navigating
  // straight to this route cannot bypass the gate.
  //
  // Fails CLOSED: if the pending count cannot be determined, proceeding is
  // not assumed to be safe.
  useEffect(() => {
    async function checkPending() {
      try {
        const pendingCount = await getPendingCount();
        setGate({
          state: pendingCount > 0 ? GateState.BLOCKED : GateState.ALLOWED,
          pendingCount,
        });
      } catch (err) {
        console.error('[ForgotPin] Failed to check pending transactions:', err);
        setGate({ state: GateState.UNKNOWN, pendingCount: 0 });
      }
    }

    checkPending();
  }, []);

  async function handleSendCode() {
    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/forgot-pin' } });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      await requestPinResetOtp(phoneNumber);
      markOtpRequested();
      navigate('/forgot-pin/verify');
    } catch (err) {
      setErrors({ general: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (gate.state === GateState.CHECKING) {
    return (
      <FormScreen>
        <p className={styles.checking}>Checking for unsynced transactions...</p>
      </FormScreen>
    );
  }

  if (gate.state === GateState.BLOCKED || gate.state === GateState.UNKNOWN) {
    const isPlural = gate.pendingCount !== 1;

    return (
      <FormScreen title="Can't reset your PIN yet">
        {gate.state === GateState.UNKNOWN ? (
          <InfoBanner tone="error">
            We could not confirm whether this device has unsynced transactions, so PIN
            reset is blocked as a precaution. Try again, or contact support if this
            continues.
          </InfoBanner>
        ) : (
          <>
            <InfoBanner tone="warning">
              You have {gate.pendingCount} unsynced transaction{isPlural ? 's' : ''} on this
              device that can only be read and sent using your current PIN. Resetting your
              PIN now would make {isPlural ? 'them' : 'it'} permanently unrecoverable.
            </InfoBanner>
            <p className={styles.guidance}>
              If you still remember your current PIN, unlock your wallet and stay online for
              a moment to let it sync, then try again. If you do not remember it, contact
              support instead — this device&apos;s unsynced transactions cannot be recovered
              any other way.
            </p>
          </>
        )}

        <Button onClick={() => navigate('/verifypin')}>Back to unlock screen</Button>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Reset your PIN"
      subtitle={
        <>
          We will send a verification code to your registered phone number:{' '}
          <strong>{maskPhoneNumber(phoneNumber)}</strong>
        </>
      }
      footer={
        <Button variant="secondary" onClick={() => navigate('/verifypin')}>
          Back to unlock screen
        </Button>
      }
    >
      <FormError>{errors.general}</FormError>

      <Button onClick={handleSendCode} loading={isSubmitting} loadingLabel="Sending code...">
        Send OTP
      </Button>
    </FormScreen>
  );
}

export default ForgotPin;