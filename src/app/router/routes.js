/**
 * Every route path in the app, in one place.
 *
 * Paths were previously string literals spread across App.jsx and roughly
 * forty navigate() calls. A typo in any of them failed silently by falling
 * through to the catch-all redirect.
 */
export const ROUTES = {
  ONBOARDING: '/',
  INSTALL: '/install',
  WELCOME: '/welcome',
  OFFLINE: '/offline',

  REGISTER: '/register',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  VERIFY_RESET_OTP: '/forgot-password/verify',
  CREATE_NEW_PASSWORD: '/forgot-password/reset',

  SET_PIN: '/set-pin',
  CHANGE_PIN: '/change-pin',
  VERIFY_PIN: '/verifypin',
  FORGOT_PIN: '/forgot-pin',
  VERIFY_PIN_RESET_OTP: '/forgot-pin/verify',
  CREATE_NEW_PIN: '/forgot-pin/reset',

  DASHBOARD: '/dashboard',
  FUND: '/fund',
  RECEIVE: '/receive',
  SEND: '/send',
};

/** Routes that require an unlocked wallet, used by the lock gate. */
export const PROTECTED_PATHS = [
  ROUTES.DASHBOARD,
  ROUTES.FUND,
  ROUTES.RECEIVE,
  ROUTES.SEND,
];