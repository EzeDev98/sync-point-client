// Sets the wallet PIN for the first time.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, PinField } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { setWalletPin } from '@features/pin/api/pinApi';
import { saveOfflinePinVerifier } from '@core/crypto/pinVerifier';
import { initializeEncryption } from '@core/crypto/keyManager';
import {
  collectErrors,
  validateNewPin,
  validatePinConfirmation,
} from '@features/pin/utils/pinValidation';

function SetPin() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const [formData, setFormData] = useState({ pin: '', confirmNewPin: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/set-pin' } });
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
      await setWalletPin(formData.pin, formData.confirmNewPin);
      await saveOfflinePinVerifier(formData.pin);
      await initializeEncryption(formData.pin);
      navigate('/dashboard');
    } catch (err) {
      setErrors({ general: err.message || 'Failed to set PIN. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormScreen
      title="Create your PIN"
      subtitle="Choose a 4-digit transaction PIN to secure your wallet"
      onSubmit={handleSubmit}
    >
      <PinField
        label="Transaction PIN"
        name="pin"
        value={formData.pin}
        onChange={handleChange}
        error={errors.pin}
        autoFocus
      />

      <PinField
        label="Confirm PIN"
        name="confirmNewPin"
        value={formData.confirmNewPin}
        onChange={handleChange}
        error={errors.confirmNewPin}
        hint="Avoid simple PINs like 1234 or 0000"
      />

      <FormError>{errors.general}</FormError>

      <Button type="submit" loading={isSubmitting} loadingLabel="Setting PIN...">
        Confirm PIN
      </Button>
    </FormScreen>
  );
}

export default SetPin;
