import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError } from '@shared/components/ui';
import { FormScreen } from '@shared/components/layout';
import { useNetwork } from '@shared/hooks/useNetwork';
import { changeWalletPin } from '@features/pin/api/pinApi';
import { saveOfflinePinVerifier } from '@features/pin/services/pinVerifier';
import { rotateEncryptionPin } from '@core/crypto/keyManager';
import PinField from '@features/pin/components/PinField/PinField.jsx';
import {
  collectErrors,
  validateNewPin,
  validatePin,
  validatePinConfirmation,
  validatePinIsDifferent,
} from '@features/pin/utils/pinValidation';

function ChangePin() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const [formData, setFormData] = useState({ oldPin: '', pin: '', confirmNewPin: '' });
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
      navigate('/offline', { state: { returnTo: '/change-pin' } });
      return;
    }

    const validationErrors = collectErrors({
      oldPin: validatePin(formData.oldPin, 'Current PIN'),
      pin: validateNewPin(formData.pin) || validatePinIsDifferent(formData.pin, formData.oldPin),
      confirmNewPin: validatePinConfirmation(formData.confirmNewPin, formData.pin),
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await changeWalletPin(formData.oldPin, formData.pin, formData.confirmNewPin);
      // The server accepted the change — bring the local PIN-derived
      // encryption key and the offline verifier in line with the new PIN.
      await rotateEncryptionPin(formData.oldPin, formData.pin);
      await saveOfflinePinVerifier(formData.pin);
      navigate('/dashboard');
    } catch (err) {
      setErrors({ general: err.message || 'Failed to change PIN. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormScreen
      title="Change your PIN"
      subtitle="Enter your current PIN, then choose a new 4-digit transaction PIN"
      onSubmit={handleSubmit}
    >
      <PinField
        label="Current PIN"
        name="oldPin"
        value={formData.oldPin}
        onChange={handleChange}
        error={errors.oldPin}
        autoFocus
      />

      <PinField
        label="New PIN"
        name="pin"
        value={formData.pin}
        onChange={handleChange}
        error={errors.pin}
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

      <Button type="submit" loading={isSubmitting} loadingLabel="Changing PIN...">
        Confirm change
      </Button>
    </FormScreen>
  );
}

export default ChangePin;