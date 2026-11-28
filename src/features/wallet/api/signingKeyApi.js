// Registers the device's signing public key with the server.
import { http } from '@core/http/httpClient';

export function registerSigningKey(signingPublicKey) {
  return http.post(
    '/wallet/signing-key',
    { signingPublicKey },
    { auth: true, fallback: 'Failed to register this device for offline payments.' }
  );
}
