import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const REGISTRATION_ID_PREFIX = 'NGB';

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 */
export function decrypt(encryptedText: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate a unique, human-readable registration ID
 * Format: NGB-YYMMDD-XXXXX (e.g., NGB-260918-12345)
 */
export function generateRegistrationId(sequenceNum?: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = sequenceNum !== undefined
    ? String(sequenceNum).padStart(5, '0')
    : String(Math.floor(10000 + Math.random() * 90000));

  return `${REGISTRATION_ID_PREFIX}-${yy}${mm}${dd}-${seq}`;
}

/**
 * Generate a random secure token
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
