import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, TextLink, PinField } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { verifyWalletPin } from '@features/pin/api/pinApi';
import { readPersisted } from '@features/auth/services/sessionManager';
import { saveOfflinePinVerifier } from '@core/crypto/pinVerifier';
import { hasOfflinePinVerifier, verifyOfflinePin } from '@core/crypto/pinVerifier';
import { ApiError } from '@core/http/ApiError';
import {
  initializeEncryption,
  isEncryptionReady,
  restoreEncryption,
} from '@core/crypto/keyManager';
import { startAutoSync, syncPendingTransactions } from '@features/sync/services/syncService';
import { PIN_LENGTH } from '@features/pin/utils/pinValidation';

/**
 * Identity fields restored from localStorage into sessionStorage when the app
 * is reopened after being closed.
 *
 * offlineBalance is deliberately absent: the offline balance is always
 * derived from IndexedDB via the wallet ledger, so a stored copy would be
 * stale the moment it was written.
 */
const PERSISTED_IDENTITY_KEYS = [
  'walletId',
  'userId',
  'phoneNumber',
  'username',
  'email',
  'userRefId',
  'firstName',
  'middleName',
  'lastName',
  'mirrorBalance',
];

/**
 * Where to go after a successful unlock: back to the route the user was on
 * when the app was backgrounded (captured by AppLockGate), or the dashboard
 * when there is nothing to return to. Read-and-clear so it is used exactly
 * once. This is what lets an in-progress transaction survive a lock, an
 * incoming call, or the app being minimised.
 */
function resolveReturnTo() {
  const returnTo = sessionStorage.getItem('lockReturnTo');
  sessionStorage.removeItem('lockReturnTo');
  return returnTo || '/dashboard';
}

function PinVerification() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const walletId = readPersisted('walletId');

  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoringTransactions, setIsRestoringTransactions] = useState(false);
  const [errorDialog, setErrorDialog] = useState(null);

  useEffect(() => {
    if (!walletId) {
      navigate('/login', { replace: true });
    }
  }, [walletId, navigate]);

  useEffect(() => {
    for (const key of PERSISTED_IDENTITY_KEYS) {
      const value = localStorage.getItem(key);
      if (value && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, value);
      }
    }
  }, []);

  function handleChange(e) {
    setPin(e.target.value);
    if (errors.pin) setErrors({});
  }

  /** Restores the encryption key, using the wrapped key when one exists. */
  async function establishEncryption(enteredPin) {
    if (localStorage.getItem('wrappedDEK')) {
      await restoreEncryption(enteredPin);
    } else {
      await initializeEncryption(enteredPin);
    }
  }

  async function runQuarantineSyncIfPending() {
    const isPending = sessionStorage.getItem('pendingQuarantineSync') === 'true';
    sessionStorage.removeItem('pendingQuarantineSync');

    if (!isPending || isOffline) return;

    setIsRestoringTransactions(true);
    try {
      await syncPendingTransactions();
    } catch (err) {
      console.warn(
        '[PinVerification] Quarantine sync failed — normal auto-sync will retry:',
        err.message
      );
    } finally {
      setIsRestoringTransactions(false);
    }
  }

  /**
   * Checks the PIN locally when asked to, or against the server otherwise. If the server can't be
   * reached (or answers 5xx/401) and this device holds a PIN verifier, it falls back to the local
   * check, so a bad connection never locks the user out of their own wallet.
   */
  async function checkPin(enteredPin, useLocal) {
    if (useLocal) return verifyOfflinePin(enteredPin);
    try {
      return await verifyWalletPin(walletId, enteredPin);
    } catch (err) {
      const serverUnavailable =
        err instanceof ApiError && (err.status === undefined || err.status >= 500 || err.status === 401);
      if (serverUnavailable && hasOfflinePinVerifier()) return verifyOfflinePin(enteredPin);
      throw err;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (pin.length < PIN_LENGTH) {
      setErrors({ pin: `Enter your ${PIN_LENGTH}-digit PIN` });
      return;
    }

    setIsSubmitting(true);

    try {
      // A quick re-lock (screen slept, app briefly backgrounded) never tore
      // down the JS runtime, so the data key is still in memory. That makes
      // this a lock-screen check rather than a fresh session resume: verify
      // locally and skip re-running encryption setup and auto-sync, which
      // would otherwise register a duplicate "online" listener every unlock.
      const isQuickRelock =
        sessionStorage.getItem('walletLocked') === 'true' && isEncryptionReady();

      const isValid = await checkPin(pin, isQuickRelock || isOffline);

      if (!isValid) {
        setErrors({ pin: 'Invalid PIN. Please try again.' });
        setPin('');
        return;
      }

      sessionStorage.removeItem('walletLocked');

      if (isQuickRelock) {
        navigate(resolveReturnTo(), { replace: true });
        return;
      }

      if (!isOffline) {
        await saveOfflinePinVerifier(pin);
      }

      await establishEncryption(pin);
      await runQuarantineSyncIfPending();

      if (!isOffline) {
        startAutoSync((result) => {
          console.log('[PinVerification] Auto-sync on resume:', result);
          window.dispatchEvent(new CustomEvent('sync-result', { detail: result }));
        });
      }

      navigate(resolveReturnTo(), { replace: true });
    } catch (err) {
      console.error('PIN verification error:', err);
      setErrorDialog(err.message || 'Unable to verify PIN. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <FormScreen
        title="Enter your PIN"
        subtitle="Enter your 4-digit PIN to unlock your wallet"
        onSubmit={handleSubmit}
        footer={<TextLink onClick={() => navigate('/forgot-pin')}>Forgot PIN?</TextLink>}
      >
        <PinField
          label="Transaction PIN"
          name="pin"
          value={pin}
          onChange={handleChange}
          error={errors.pin}
          autoFocus
        />

        <Button
          type="submit"
          disabled={pin.length < PIN_LENGTH}
          loading={isSubmitting}
          loadingLabel="Unlocking..."
        >
          Unlock wallet
        </Button>
      </FormScreen>

      <Modal
        open={isRestoringTransactions}
        icon="🔄"
        title="Syncing previous transactions"
        dismissOnOverlayClick={false}
        dismissOnEscape={false}
      >
        We found transactions from your last session on this device. This will only take
        a moment.
      </Modal>

      <Modal
        open={Boolean(errorDialog)}
        icon="⚠️"
        title="Verification failed"
        onClose={() => setErrorDialog(null)}
        actions={<Button onClick={() => setErrorDialog(null)}>OK</Button>}
      >
        {errorDialog}
      </Modal>
    </>
  );
}

export default PinVerification;