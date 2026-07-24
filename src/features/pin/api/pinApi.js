import { http } from '@core/http/httpClient';
import { requirePhoneNumber } from '@features/auth/services/sessionManager';

/**
 * Wallet PIN: set, change, verify, and recovery by OTP.
 *
 * checkPinSet lives in authApi, not here — its only caller is the sign-in
 * flow deciding where to route, and features/auth must not import from
 * features/pin.
 */

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

/**
 * ⚠️ REQUIRES A BACKEND CHANGE — see below.
 *
 * The server currently declares this as:
 *     @GetMapping("/wallet/verify/pin")
 *     public ResponseEntity<Boolean> verifyPin(@RequestBody VerifyPinRequest request)
 *
 * A GET carrying a request body cannot be sent from a browser. The Fetch
 * spec forbids it outright — fetch throws before the request leaves the
 * machine — and XMLHttpRequest drops the body silently. Spring accepts the
 * mapping because it is server-side, and curl or a Java client can send it,
 * which is why this passed testing but never worked in the app. It is also
 * why the original client function was abandoned half-written.
 *
 * This is written as a POST. Change the server annotation to @PostMapping
 * and it works as-is; nothing else about the contract changes.
 *
 * Do NOT resolve this by moving the fields into query parameters: the PIN
 * would then appear in access logs, browser history and proxy logs, and GET
 * responses are cacheable — including by this app's own service worker.
 *
 * Returns a bare boolean, matching ResponseEntity<Boolean>.
 */
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