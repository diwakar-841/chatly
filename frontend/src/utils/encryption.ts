import nacl from "tweetnacl";
import * as util from "tweetnacl-util";

const LEGACY_KEY = "chatly-e2e-keys";
const keyStorageKey = (userId: string) => {
  return `chatly-e2e-keys-${userId}`;
};
const registeredKeyStorageKey = (userId: string) => {
  return `chatly-e2e-registered-key-${userId}`;
};

export const generateKeyPair = (): { publicKey: string; secretKey: string } => {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    secretKey: util.encodeBase64(keyPair.secretKey),
  };
};

export const deriveSharedSecret = (pubKey: string, secretKey: string): Uint8Array => {
  const pk = util.decodeBase64(pubKey);
  const sk = util.decodeBase64(secretKey);
  return nacl.box.before(pk, sk);
};

export const encryptForSend = (
  plaintext: string,
  sharedSecret: Uint8Array
): { encrypted: string; nonce: string } => {
  const nonce = nacl.randomBytes(24);
  const encrypted = nacl.box.after(util.decodeUTF8(plaintext), nonce, sharedSecret);
  return {
    encrypted: util.encodeBase64(encrypted),
    nonce: util.encodeBase64(nonce),
  };
};

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
    if (!decrypted) {
      return null;
    }
    return util.encodeUTF8(decrypted);
  } catch {
    return null;
  }
};


export const getOrCreateKeyPair = (userId: string): { publicKey: string; secretKey: string } => {
  const scopedKey = keyStorageKey(userId);

  
  try {
    const stored = localStorage.getItem(scopedKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { publicKey: string; secretKey: string };
      if (parsed.publicKey && parsed.secretKey) {
        return parsed;
      }
    }
  } catch {
    
  }

  
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { publicKey: string; secretKey: string };
      if (parsed.publicKey && parsed.secretKey) {
        localStorage.setItem(scopedKey, legacy);
        return parsed;
      }
    }
  } catch {
    
  }

  
  const kp = generateKeyPair();
  try {
    localStorage.setItem(scopedKey, JSON.stringify(kp));
  } catch {
    
  }
  return kp;
};

export const isKeyRegistered = (userId: string, publicKey: string): boolean => {
  try {
    return localStorage.getItem(registeredKeyStorageKey(userId)) === publicKey;
  } catch {
    return false;
  }
};

export const markKeyRegistered = (userId: string, publicKey: string): void => {
  try {
    localStorage.setItem(registeredKeyStorageKey(userId), publicKey);
  } catch {
    
  }
};
