import { Navigate, Route } from 'react-router-dom';
import {
  CreateNewPassword,
  ForgotPassword,
  Login,
  Register,
  VerifyAccount,
  VerifyResetOtp,
  Welcome,
} from '@features/auth';
import {
  ChangePin,
  CreateNewPin,
  ForgotPin,
  PinVerification,
  SetPin,
  VerifyPinResetOtp,
} from '@features/pin';
import {
  Dashboard,
  FundWallet,
  ReceivePayment,
  SendMoney,
  TransactionHistory,
} from '@features/wallet';
import { InstallPage, Offline, Onboarding } from '@features/device';
import AnimatedRoutes from '@app/router/AnimatedRoutes.jsx';
import InstallGuard from '@app/router/guards/InstallGuard.jsx';
import RequireUnlock from '@app/router/guards/RequireUnlock.jsx';
import { ROUTES } from '@app/router/routes';
import { ComingSoon } from '@shared/pages';

/**
 * Every route is declared here as data rather than as nested JSX, so the
 * guard stack for each one is visible at a glance instead of buried in four
 * levels of wrapper elements.
 *
 *   installed — requires the PWA to be installed
 *   unlocked  — additionally requires the wallet to be unlocked
 */
const ROUTE_CONFIG = [
  { path: ROUTES.ONBOARDING, element: <Onboarding /> },
  { path: ROUTES.INSTALL, element: <InstallPage /> },

  { path: ROUTES.WELCOME, element: <Welcome />, installed: true },
  { path: ROUTES.OFFLINE, element: <Offline />, installed: true },

  { path: ROUTES.REGISTER, element: <Register />, installed: true },
  { path: ROUTES.VERIFY_ACCOUNT, element: <VerifyAccount />, installed: true },
  { path: ROUTES.LOGIN, element: <Login />, installed: true },
  { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPassword />, installed: true },
  { path: ROUTES.VERIFY_RESET_OTP, element: <VerifyResetOtp />, installed: true },
  { path: ROUTES.CREATE_NEW_PASSWORD, element: <CreateNewPassword />, installed: true },

  { path: ROUTES.SET_PIN, element: <SetPin />, installed: true },
  { path: ROUTES.VERIFY_PIN, element: <PinVerification />, installed: true },
  { path: ROUTES.FORGOT_PIN, element: <ForgotPin />, installed: true },
  { path: ROUTES.VERIFY_PIN_RESET_OTP, element: <VerifyPinResetOtp />, installed: true },
  { path: ROUTES.CREATE_NEW_PIN, element: <CreateNewPin />, installed: true },
  { path: ROUTES.CHANGE_PIN, element: <ChangePin />, installed: true, unlocked: true },

  { path: ROUTES.DASHBOARD, element: <Dashboard />, installed: true, unlocked: true },
  { path: ROUTES.TRANSACTIONS, element: <TransactionHistory />, installed: true, unlocked: true },
  { path: ROUTES.FUND, element: <FundWallet />, installed: true, unlocked: true },
  { path: ROUTES.RECEIVE, element: <ReceivePayment />, installed: true, unlocked: true },
  { path: ROUTES.SEND, element: <SendMoney />, installed: true, unlocked: true },
  { path: ROUTES.COMING_SOON, element: <ComingSoon />, installed: true, unlocked: true },
];

/** Wraps an element in whichever guards its config asks for, innermost first. */
function withGuards(element, { installed, unlocked }) {
  let guarded = element;

  if (unlocked) guarded = <RequireUnlock>{guarded}</RequireUnlock>;
  if (installed) guarded = <InstallGuard>{guarded}</InstallGuard>;

  return guarded;
}

function AppRouter() {
  return (
    <AnimatedRoutes>
      {ROUTE_CONFIG.map(({ path, element, installed, unlocked }) => (
        <Route key={path} path={path} element={withGuards(element, { installed, unlocked })} />
      ))}

      <Route path="*" element={<Navigate to={ROUTES.ONBOARDING} replace />} />
    </AnimatedRoutes>
  );
}

export default AppRouter;