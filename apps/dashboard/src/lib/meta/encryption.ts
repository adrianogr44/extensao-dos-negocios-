import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex';

/**
 * Encripta um token usando AES-256-GCM
 */
export function encryptToken(token: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag();

  // Combina: iv + authTag + encrypted
  return [
    iv.toString(ENCODING),
    authTag.toString(ENCODING),
    encrypted,
  ].join(':');
}

/**
 * Decripta um token
 */
export function decryptToken(encryptedData: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, ENCODING);
  const authTag = Buffer.from(authTagHex, ENCODING);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Deriva uma chave do masterKey usando PBKDF2
 */
function deriveKey(masterKey: string): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    'meta-scheduler-salt', // salt (fixo para determinismo)
    100000, // iterations
    KEY_LENGTH,
    'sha256',
  );
}

/**
 * Valida a chave de encriptação
 */
export function validateEncryptionKey(key: string): boolean {
  return !!key && key.length >= 16;
}
