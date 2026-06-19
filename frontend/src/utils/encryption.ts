import nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';

/**
 * FIX: Key storage is now scoped per user-ID.
 *
 * The original implementation used a single shared localStorage key
 * (`chatly-e2e-keys`) for ALL users on the same browser/device.  When two
 * accounts are tested in the same browser (e.g. Sanjay then Manoj), the
 * second user's `getOrCreateKeyPair()` call would find the first user's key
 * already in storage and return IT.  Manoj would then register Sanjay's
 * public key as his own, making both parties derive the same-but-wrong
 * shared secret and failing to decrypt every message.
 *
 * Scoping by userId guarantees each account gets its own stable keypair
 * regardless of how many accounts share the same browser.
 */
const keyStorageKey = (userId: string) => `chatly-e2e-keys-${userId}`;
const registeredKeyStorageKey = (userId: string) => `chatly-e2e-registered-key-${userId}`;

/**
 * Generates a fresh NaCl Curve25519 keypair and returns both keys as
 * base64-encoded strings. The secret key must remain on-device; only the
 * public key is shared with the server.
 */
export const generateKeyPair = (): { publicKey: string; secretKey: string } => {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    secretKey: util.encodeBase64(keyPair.secretKey),
  };
};

/**
 * Derives a symmetric shared secret from the other party's public key and
 * our own secret key using the NaCl box algorithm (X25519 + XSalsa20-Poly1305).
 * Both sides derive the same secret independently — no exchange needed.
 */
export const deriveSharedSecret = (
  pubKey: string,
  secretKey: string
): Uint8Array => {
  const pk = util.decodeBase64(pubKey);
  const sk = util.decodeBase64(secretKey);
  return nacl.box.before(pk, sk);
};

/**
 * Encrypts a plaintext string with NaCl secretbox using a random 24-byte nonce.
 * Returns both the ciphertext and nonce as base64 strings; both must be stored
 * alongside the message so the recipient can decrypt it.
 */
export const encryptForSend = (
  plaintext: string,
  sharedSecret: Uint8Array
): { encrypted: string; nonce: string } => {
  const nonce = nacl.randomBytes(24);
  const encrypted = nacl.box.after(
    util.decodeUTF8(plaintext),
    nonce,
    sharedSecret
  );
  return {
    encrypted: util.encodeBase64(encrypted),
    nonce: util.encodeBase64(nonce),
  };
};

/**
 * Decrypts a ciphertext that was encrypted with `encryptForSend`.
 * Returns the plaintext string on success, or null on failure (wrong key,
 * corrupted data, etc.). Callers should check for null and fall back gracefully
 * rather than surfacing an error string as message content.
 */
export const decryptMessage = (
  encrypted: string,
  nonce: string,
  sharedSecret: Uint8Array
): string | null => {
  try {
    const decrypted = nacl.box.open.after(
      util.decodeBase64(encrypted),
      util.decodeBase64(nonce),
      sharedSecret
    );
    if (!decrypted) return null;
    return util.encodeUTF8(decrypted);
  } catch {
    return null;
  }
};

/**
 * Returns the stored E2E keypair for this userId from localStorage, or
 * generates and stores a fresh one if none exists.
 *
 * FIX: scoped to userId so multiple accounts on the same browser each get
 * their own independent keypair.
 */
export const getOrCreateKeyPair = (userId: string): { publicKey: string; secretKey: string } => {
  try {
    const stored = localStorage.getItem(keyStorageKey(userId));
    if (stored) {
      const parsed = JSON.parse(stored) as { publicKey: string; secretKey: string };
      if (parsed.publicKey && parsed.secretKey) return parsed;
    }
  } catch {
    // Fall through and generate a new pair if storage is unavailable or corrupt.
  }
  const kp = generateKeyPair();
  localStorage.setItem(keyStorageKey(userId), JSON.stringify(kp));
  return kp;
};

/**
 * Returns true if this exact public key has already been successfully
 * registered with the server for this userId in this browser.
 *
 * FIX: scoped to userId.
 */
export const isKeyRegistered = (userId: string, publicKey: string): boolean => {
  try {
    return localStorage.getItem(registeredKeyStorageKey(userId)) === publicKey;
  } catch {
    return false;
  }
};

/**
 * Marks the given public key as having been registered with the server for userId.
 * Call this only after setPublicKey succeeds.
 *
 * FIX: scoped to userId.
 */
export const markKeyRegistered = (userId: string, publicKey: string): void => {
  try {
    localStorage.setItem(registeredKeyStorageKey(userId), publicKey);
  } catch {
    // ignore
  }
};
