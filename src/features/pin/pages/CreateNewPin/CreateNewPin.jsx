import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, Modal } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { completePinReset } from '@features/pin/api/pinApi';
import { saveOfflinePinVerifier } from '@features/pin/services/pinVerifier';
import { initializeEncryption } from '@core/crypto/keyManager';
import {
  clearPinResetState,
  getPinResetToken,
  hasPinResetToken,
} from '@features/pin/state/pinResetState';
import PinField from '@features/pin/components/PinField/PinField.jsx';
import {
  collectErrors,
  validateNewPin,
  validatePinConfirmation,
} from '@features/pin/utils/pinValidation';

function CreateNewPin() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const resetToken = getPinResetToken();

  const [formData, setFormData] = useState({ pin: '', confirmNewPin: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reaching this step without a verified reset token is not a valid state.
  useEffect(() => {
    if (!hasPinResetToken()) {
      navigate('/forgot-pin', { replace: true });
    }
  }, [navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/forgot-pin/reset' } });
      return;
    }

    const validationErrors = collectErrors({
      pin: validateNewPin(formData.pin),
      confirmNewPin: validatePinConfirmation(formData.confirmNewPin, formData.pin),
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // The same three calls as the first-time SetPin flow: on the client a
      // PIN reset is just "set the PIN again". The server-side resetToken is
      // what proves this is authorised, and generating a fresh data key here
      // is safe because ForgotPin already confirmed there is no unsynced
      // offline data tied to the old one.
      await completePinReset(resetToken, formData.pin, formData.confirmNewPin);
      await saveOfflinePinVerifier(formData.pin);
      await initializeEncryption(formData.pin);
      clearPinResetState();
      setShowSuccess(true);
    } catch (err) {
      setErrors({ general: err.message || 'Failed to reset PIN. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <FormScreen
        title="Create a new PIN"
        subtitle="Choose a new 4-digit transaction PIN"
        onSubmit={handleSubmit}
      >
        <PinField
          label="New transaction PIN"
          name="pin"
          value={formData.pin}
          onChange={handleChange}
          error={errors.pin}
          autoFocus
        />

        <PinField
          label="Confirm new PIN"
          name="confirmNewPin"
          value={formData.confirmNewPin}
          onChange={handleChange}
          error={errors.confirmNewPin}
          hint="Avoid simple PINs like 1234 or 0000"
        />

        <FormError>{errors.general}</FormError>

        <Button type="submit" loading={isSubmitting} loadingLabel="Resetting PIN...">
          Confirm new PIN
        </Button>
      </FormScreen>

      <Modal
        open={showSuccess}
        icon="✅"
        title="PIN reset successful"
        dismissOnOverlayClick={false}
        dismissOnEscape={false}
        actions={<Button onClick={() => navigate('/verifypin', { replace: true })}>OK</Button>}
      >
        Your transaction PIN has been updated. Verify your new PIN to unlock your wallet.
      </Modal>
    </>
  );
}

export default CreateNewPin;