/**
 * Base64 ↔ byte conversions used by every crypto module.
 *
 * These four lines were written inline eight times across cryptoService and
 * the PIN verifier, in both directions.
 */

/**
 * Converts bytes to base64 in chunks.
 *
 * `String.fromCharCode(...bytes)` — what the original code used — spreads
 * the whole array into the argument list, and engines cap that at roughly
 * 65k arguments. Transaction payloads are far below the limit today, so the
 * old form worked, but it would fail on a large record rather than
 * degrading. Chunking removes the ceiling.
 */
export function bytesToBase64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const CHUNK_SIZE = 0x8000;

  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }

  return btoa(binary);
}

export function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function encodeUtf8(text) {
  return new TextEncoder().encode(text);
}

export function decodeUtf8(buffer) {
  return new TextDecoder().decode(buffer);
}