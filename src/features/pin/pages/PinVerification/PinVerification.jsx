// Unlocks the wallet with the PIN, online or offline.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, TextLink, PinField } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { verifyWalletPin } from '@features/pin/api/pinApi';
import { checkPinSet } from '@features/auth/api/authApi';
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

  useEffect(() => {
    if (!walletId || isOffline) return;
    checkPinSet(walletId).catch(() => {});
  }, [walletId, isOffline]);

  function handleChange(e) {
    setPin(e.target.value);
    if (errors.pin) setErrors({});
  }

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

  async function checkPin(enteredPin, useLocal) {
    if (useLocal) return verifyOfflinePin(enteredPin);
    try {
      return await verifyWalletPin(walletId, enteredPin);
    } catch (err) {
      if (err instanceof ApiError && err.body?.code === 'SESSION_REVOKED') throw err;
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
