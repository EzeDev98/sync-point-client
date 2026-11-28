// Every route path in the app.
export const ROUTES = {
  ONBOARDING: '/',
  INSTALL: '/install',
  WELCOME: '/welcome',
  OFFLINE: '/offline',

  REGISTER: '/register',
  VERIFY_ACCOUNT: '/verify-account',
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
  TRANSACTIONS: '/transactions',
  FUND: '/fund',
  RECEIVE: '/receive',
  SEND: '/send',
  COMING_SOON: '/coming-soon',
};

export const PROTECTED_PATHS = [
  ROUTES.DASHBOARD,
  ROUTES.TRANSACTIONS,
  ROUTES.FUND,
  ROUTES.RECEIVE,
  ROUTES.SEND,
];
