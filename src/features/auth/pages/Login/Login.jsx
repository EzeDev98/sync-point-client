import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Checkbox,
  FormError,
  InfoBanner,
  Modal,
  TextField,
  TextLink,
} from '@shared/components/ui';
import { UpdateModal } from '@shared/components/feedback';
import { useNetwork } from '@shared/hooks/useNetwork';
import { getIsOnline } from '@core/network/networkService';
import { checkPinSet, loginUser } from '@features/auth/api/authApi';
import { persistValue, hasResumableSession } from '@features/auth/services/sessionManager';
import { refreshOnStartup } from '@features/auth/services/tokenStore';
import { restoreQuarantineIfPresent } from '@features/device/services/quarantineService';
import { performHardReset } from '@features/device/services/hardReset';
import { checkForUpdate } from '@features/device/services/versionService';
import AuthLayout from '@features/auth/components/AuthLayout/AuthLayout.jsx';
import { collectErrors, validatePhoneNumber } from '@features/auth/utils/authValidation';
import styles from './Login.module.css';

const MANDATORY_POLL_MS = 15_000;

function Login() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const [formData, setFormData] = useState({
    phoneNumber: '',
    password: '',
    rememberMe: true,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [updateInfo, setUpdateInfo] = useState({ show: false, remoteBuildId: null });
  const [isUpdating, setIsUpdating] = useState(false);

  // One piece of state for every dialog this page can raise, instead of the
  // four independent booleans the previous version tracked.
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    async function checkUpdateThenSession() {
      if (getIsOnline()) {
        const { updateAvailable, remoteBuildId } = await checkForUpdate();
        if (updateAvailable) {
          setUpdateInfo({ show: true, remoteBuildId });
          setIsCheckingSession(false);
          return;
        }
      }

      if (!hasResumableSession()) {
        setIsCheckingSession(false);
        return;
      }

      if (!getIsOnline()) {
        navigate('/verifypin', { replace: true });
        return;
      }

      try {
        await refreshOnStartup();
        navigate('/verifypin', { replace: true });
      } catch {
        setIsCheckingSession(false);
      }
    }

    checkUpdateThenSession();
  }, [navigate]);

  // Login is the only screen where an update can be applied safely, because a
  // fresh sign-in is guaranteed to have no pending transactions. Poll while
  // the user is here, and re-check the moment the tab regains focus so a
  // connection that returns mid-visit is caught without a manual refresh.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (!getIsOnline()) return;
      try {
        const { updateAvailable, remoteBuildId } = await checkForUpdate();
        if (!cancelled && updateAvailable) {
          setUpdateInfo({ show: true, remoteBuildId });
        }
      } catch (err) {
        console.warn('[Login] Mandatory update check failed:', err);
      }
    }

    const intervalId = setInterval(poll, MANDATORY_POLL_MS);

    function handleVisibility() {
      if (document.visibilityState === 'visible') poll();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  async function handleUpdateNow() {
    setIsUpdating(true);
    try {
      await performHardReset();
    } catch (err) {
      console.error('[Login] Hard reset failed:', err);
      setIsUpdating(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function persistSession(data) {
    sessionStorage.setItem('sessionToken', data.token);
    sessionStorage.setItem('accessTokenExpiresIn', data.accessTokenExpiresIn);

    const persisted = {
      walletId: data.wallet_id,
      userId: data.user_id,
      phoneNumber: data.phone_number,
      username: data.username,
      email: data.email,
      userRefId: data.user_ref_id,
      firstName: data.first_name,
      middleName: data.middle_name,
      lastName: data.last_name,
      mirrorBalance: data.mirror_balance,
      refreshToken: data.refreshToken,
      refreshTokenExpiresIn: data.refreshTokenExpiresIn,
      tokenIssuedAt: Date.now().toString(),
    };

    Object.entries(persisted).forEach(([key, value]) => persistValue(key, value));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isOffline) {
      navigate('/offline', { state: { returnTo: '/login' } });
      return;
    }

    const validationErrors = collectErrors({
      phoneNumber: validatePhoneNumber(formData.phoneNumber),
      password: formData.password ? '' : 'Password is required',
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await loginUser(formData.phoneNumber, formData.password);
      persistSession(data);

      const hadQuarantinedData = await restoreQuarantineIfPresent(data.wallet_id);
      if (hadQuarantinedData) {
        sessionStorage.setItem('pendingQuarantineSync', 'true');
      }

      const pinSet = await checkPinSet(data.wallet_id);
      if (pinSet === false) {
        setDialog({ kind: 'pinRequired' });
      } else {
        navigate('/verifypin');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.status === 409) {
        setDialog({ kind: 'activeSession' });
      } else {
        setDialog({
          kind: 'error',
          message: err.message || 'Something went wrong. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <AuthLayout>
        <p className={styles.checkingSession}>Checking session...</p>
      </AuthLayout>
    );
  }

  // A mandatory update takes over the screen entirely — there is no "Later".
  if (updateInfo.show) {
    return (
      <AuthLayout>
        <UpdateModal onUpdate={handleUpdateNow} isUpdating={isUpdating} mandatory />
      </AuthLayout>
    );
  }

  return (
    <>
      <AuthLayout
        title="Welcome back"
        subtitle="Sign in to your account"
        onSubmit={handleSubmit}
        banner={
          isOffline && (
            <InfoBanner tone="warning">
              📡 You are offline. Connect to the internet to sign in.
            </InfoBanner>
          )
        }
        footer={
          <p>
            Don&apos;t have an account? <TextLink to="/register">Create account</TextLink>
          </p>
        }
      >
        <TextField
          label="Phone number"
          name="phoneNumber"
          type="tel"
          placeholder="08012345678"
          value={formData.phoneNumber}
          onChange={handleChange}
          error={errors.phoneNumber}
          autoComplete="tel"
        />

        <TextField
          label="Password"
          name="password"
          secret
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className={styles.optionsRow}>
          <Checkbox
            label="Remember me"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
          />
          <TextLink onClick={() => navigate('/forgot-password')}>Forgot password?</TextLink>
        </div>

        <FormError>{errors.general}</FormError>

        <Button type="submit" loading={isSubmitting} loadingLabel="Signing in...">
          Sign in
        </Button>
      </AuthLayout>

      <Modal
        open={dialog?.kind === 'pinRequired'}
        icon="🔐"
        title="Set your transaction PIN"
        dismissOnOverlayClick={false}
        dismissOnEscape={false}
        actions={<Button onClick={() => navigate('/set-pin')}>Set PIN now</Button>}
      >
        To keep your wallet secure you need to set a 4-digit transaction PIN before you
        can reach your dashboard.
      </Modal>

      <Modal
        open={dialog?.kind === 'activeSession'}
        icon="🔒"
        title="Already signed in elsewhere"
        onClose={() => setDialog(null)}
        actions={<Button onClick={() => setDialog(null)}>OK</Button>}
      >
        This account is active on another device. To protect your transaction data,
        unlock your wallet on that device and sign out properly before signing in here.
      </Modal>

      <Modal
        open={dialog?.kind === 'error'}
        icon="⚠️"
        title="Sign-in failed"
        onClose={() => setDialog(null)}
        actions={<Button onClick={() => setDialog(null)}>OK</Button>}
      >
        {dialog?.message}
      </Modal>
    </>
  );
}

export default Login;