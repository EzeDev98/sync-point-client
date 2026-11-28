// Base64, byte and UTF-8 conversions used by the crypto modules.
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
