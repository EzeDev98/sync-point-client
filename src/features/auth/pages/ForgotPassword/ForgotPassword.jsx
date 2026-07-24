import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, TextField, TextLink } from '@shared/components/ui';
import { useNetwork } from '@shared/hooks/useNetwork';
import { requestPasswordResetOtp } from '@features/auth/api/authApi';
import { setPhoneNumber as savePhoneNumber } from '@features/auth/state/passwordResetState';
import { FormScreen } from '@shared/components/layout';
import { validatePhoneNumber } from '@features/auth/utils/authValidation';

function ForgotPassword() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const [phoneNumber, setPhoneNumberInput] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    setPhoneNumberInput(e.target.value);
    if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/forgot-password' } });
      return;
    }

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      setErrors({ phoneNumber: phoneError });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await requestPasswordResetOtp(phoneNumber);
      savePhoneNumber(phoneNumber);
      navigate('/forgot-password/verify');
    } catch (err) {
      setErrors({ general: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormScreen
      title="Forgot password?"
      subtitle="Enter the phone number associated with your account."
      onSubmit={handleSubmit}
      footer={<TextLink to="/login">Back to login</TextLink>}
    >
      <TextField
        label="Phone number"
        name="phoneNumber"
        type="tel"
        placeholder="08012345678"
        value={phoneNumber}
        onChange={handleChange}
        error={errors.phoneNumber}
      />

      <FormError>{errors.general}</FormError>

      <Button type="submit" loading={isSubmitting} loadingLabel="Sending code...">
        Send OTP
      </Button>
    </FormScreen>
  );
}

export default ForgotPassword;