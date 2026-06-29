export async function saveOfflinePinVerifier(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const encoder = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 600000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  localStorage.setItem(
    "pin_salt",
    btoa(String.fromCharCode(...salt))
  );

  localStorage.setItem(
    "pin_verifier",
    btoa(String.fromCharCode(...new Uint8Array(derivedBits)))
  );

  localStorage.setItem(
    "pin_verified_at",
    Date.now().toString()
  );
}