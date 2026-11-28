// Wallet PIN API calls: set, change, verify and reset by OTP.
import { http } from '@core/http/httpClient';
import { requirePhoneNumber } from '@features/auth/services/sessionManager';

export function setWalletPin(pin, confirmNewPin) {
  return http.post(
    '/wallet/set-pin',
    { phoneNumber: requirePhoneNumber(), pin, confirmNewPin },
    { auth: true, fallback: 'Failed to set PIN. Please try again.' }
  );
}

export function changeWalletPin(oldPin, pin, confirmNewPin) {
  return http.put(
    '/wallet/change-pin',
    { phoneNumber: requirePhoneNumber(), oldPin, pin, confirmNewPin },
    { auth: true, fallback: 'Failed to change PIN. Please try again.' }
  );
}

export function verifyWalletPin(walletId, pin) {
  return http.post(
    '/wallet/verify/pin',
    { walletId, unverifiedPin: pin },
    { auth: true, fallback: 'PIN verification failed.' }
  );
}

export function requestPinResetOtp(phoneNumber) {
  return http.post('/pin-reset/request', { phoneNumber }, { auth: true });
}

export function verifyPinResetOtp(phoneNumber, otp) {
  return http.post(
    '/pin-reset/verify-otp',
    { phoneNumber, otp },
    { auth: true, fallback: 'The verification code is invalid.' }
  );
}

export function completePinReset(resetToken, pin, confirmNewPin) {
  return http.post('/pin-reset/complete', { resetToken, pin, confirmNewPin }, { auth: true });
}
