import { http } from '@core/http/httpClient';

/**
 * Registers this device's offline-transfer signing public key with the
 * server, which stores it on the caller's own wallet (resolved from the
 * token) and later uses it to verify the signatures on transfers this wallet
 * sends.
 *
 * @param signingPublicKey base64 SPKI, ECDSA P-256
 */
export function registerSigningKey(signingPublicKey) {
  return http.post(
    '/wallet/signing-key',
    { signingPublicKey },
    { auth: true, fallback: 'Failed to register this device for offline payments.' }
  );
}