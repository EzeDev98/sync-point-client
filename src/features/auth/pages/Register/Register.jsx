import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ButtonGroup,
  FormError,
  InfoBanner,
  SelectField,
  TextField,
  TextLink,
} from '@shared/components/ui';
import { useNetwork } from '@shared/hooks/useNetwork';
import { registerUser } from '@features/auth/api/authApi';
import AuthLayout from '@features/auth/components/AuthLayout/AuthLayout.jsx';
import StepIndicator from '@features/auth/components/StepIndicator/StepIndicator.jsx';
import {
  collectErrors,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validatePhoneNumber,
  validateRequired,
} from '@features/auth/utils/authValidation';
import styles from './Register.module.css';

const STEPS = ['Basic info', 'Security & demographics'];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  username: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  gender: '',
  dateOfBirth: '',
};

function Register() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function validateStepOne() {
    return collectErrors({
      firstName: validateRequired(formData.firstName, 'First name'),
      lastName: validateRequired(formData.lastName, 'Last name'),
      username: validateRequired(formData.username, 'Username'),
      email: validateEmail(formData.email),
      phoneNumber: validatePhoneNumber(formData.phoneNumber),
    });
  }

  function validateStepTwo() {
    return collectErrors({
      password: validatePassword(formData.password),
      confirmPassword: validatePasswordConfirmation(
        formData.confirmPassword,
        formData.password
      ),
      gender: formData.gender ? '' : 'Please select a gender',
      dateOfBirth: formData.dateOfBirth ? '' : 'Date of birth is required',
    });
  }

  function handleNext() {
    const validationErrors = validateStepOne();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setStep(2);
  }

  function handleBack() {
    setErrors({});
    setStep(1);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/register' } });
      return;
    }

    const validationErrors = validateStepTwo();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser(formData);
      navigate('/login', {
        state: { message: 'Registration successful. Please sign in.' },
      });
    } catch (err) {
      console.error('Registration error:', err);
      setErrors({
        general: err.message || 'Registration failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      wide
      scrollable
      title="Create your account"
      subtitle="Join SyncPoint today"
      header={<StepIndicator steps={STEPS} current={step} />}
      onSubmit={handleSubmit}
      banner={
        isOffline && (
          <InfoBanner tone="warning">
            📡 You are offline. Connect to the internet to register.
          </InfoBanner>
        )
      }
      footer={
        <p>
          Already have an account? <TextLink to="/login">Sign in</TextLink>
        </p>
      }
    >
      <div className={styles.slider}>
        <div className={[styles.track, step === 2 ? styles.trackStepTwo : ''].join(' ')}>
          {/* Step 1 — basic info */}
          <section className={styles.step} aria-hidden={step !== 1}>
            <div className={styles.fields}>
              <div className={styles.row}>
                <TextField
                  label="First name"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                />
                <TextField
                  label="Last name"
                  name="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                />
              </div>

              <TextField
                label="Middle name"
                name="middleName"
                optional
                placeholder="Optional"
                value={formData.middleName}
                onChange={handleChange}
              />

              <TextField
                label="Username"
                name="username"
                placeholder="johndoe"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
              />

              <TextField
                label="Email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
              />

              <TextField
                label="Phone number"
                name="phoneNumber"
                type="tel"
                placeholder="08012345678"
                value={formData.phoneNumber}
                onChange={handleChange}
                error={errors.phoneNumber}
              />
            </div>
          </section>

          {/* Step 2 — security and demographics */}
          <section className={styles.step} aria-hidden={step !== 2}>
            <div className={styles.fields}>
              <TextField
                label="Password"
                name="password"
                secret
                placeholder="Enter a password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                hint="Minimum 8 characters"
              />

              <TextField
                label="Confirm password"
                name="confirmPassword"
                secret
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
              />

              <div className={styles.row}>
                <SelectField
                  label="Gender"
                  name="gender"
                  placeholder="Select"
                  options={GENDER_OPTIONS}
                  value={formData.gender}
                  onChange={handleChange}
                  error={errors.gender}
                />

                <TextField
                  label="Date of birth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  error={errors.dateOfBirth}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <FormError>{errors.general}</FormError>

      {step === 1 ? (
        <Button onClick={handleNext}>Next</Button>
      ) : (
        <ButtonGroup direction="row">
          <Button variant="secondary" onClick={handleBack}>
            Back
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="Creating account...">
            Register
          </Button>
        </ButtonGroup>
      )}
    </AuthLayout>
  );
}

export default Register;