import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormError, Modal, TextField } from '@shared/components/ui';
import { useNetwork } from '@shared/hooks/useNetwork';
import { completePasswordReset } from '@features/auth/api/authApi';
import {
  clearPasswordResetState,
  getResetToken,
  hasResetToken,
} from '@features/auth/state/passwordResetState';
import { FormScreen } from '@shared/components/layout';
import {
  PASSWORD_MIN_LENGTH,
  collectErrors,
  validatePassword,
  validatePasswordConfirmation,
} from '@features/auth/utils/authValidation';

function CreateNewPassword() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();
  const resetToken = getResetToken();

  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reaching this step without a verified reset token is not a valid state.
  useEffect(() => {
    if (!hasResetToken()) {
      navigate('/forgot-password', { replace: true });
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
      navigate('/offline', { state: { returnTo: '/forgot-password/reset' } });
      return;
    }

    const validationErrors = collectErrors({
      newPassword: validatePassword(formData.newPassword),
      confirmPassword: validatePasswordConfirmation(
        formData.confirmPassword,
        formData.newPassword
      ),
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await completePasswordReset(
        resetToken,
        formData.newPassword,
        formData.confirmPassword
      );
      clearPasswordResetState();
      setShowSuccess(true);
    } catch (err) {
      // An expired token means the whole flow has to start over.
      if (err.status === 400 && /expired|start again/i.test(err.message || '')) {
        clearPasswordResetState();
      }
      setErrors({ general: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <FormScreen
        title="Create a new password"
        subtitle="Choose a strong password for your account."

        onBack={() => {
          clearPasswordResetState();
          navigate('/forgot-password');
        }}
        backLabel="Back"
        onSubmit={handleSubmit}
      >
        <TextField
          label="New password"
          name="newPassword"
          secret
          placeholder="Enter your new password"
          value={formData.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
          hint={`Must be at least ${PASSWORD_MIN_LENGTH} characters.`}
        />

        <TextField
          label="Confirm new password"
          name="confirmPassword"
          secret
          placeholder="Re-enter your new password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <FormError>{errors.general}</FormError>

        <Button type="submit" loading={isSubmitting} loadingLabel="Resetting password...">
          Reset password
        </Button>
      </FormScreen>

      <Modal
        open={showSuccess}
        icon="✅"
        title="Password reset successful"
        dismissOnOverlayClick={false}
        dismissOnEscape={false}
        actions={
          <Button onClick={() => navigate('/login', { replace: true })}>Back to login</Button>
        }
      >
        Your password has been updated. For your security you have been signed out
        everywhere and will need to sign in again.
      </Modal>
    </>
  );
}

export default CreateNewPassword;