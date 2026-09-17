import crypto from 'crypto';
import { REGISTRATION_ID_PREFIX } from '@ngb/shared';

const ALGORITHM = 'aes-256-gcm';

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
 * Format: NGB-YYMMDD-XXXXX (e.g., NGB-260916-00042)
 */
export function generateRegistrationId(sequenceNum: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String(sequenceNum).padStart(5, '0');
  return `${REGISTRATION_ID_PREFIX}-${yy}${mm}${dd}-${seq}`;
}

/**
 * Generate a random verification code (numeric)
 */
export function generateVerificationCode(length: number = 6): string {
  const digits = '0123456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += digits[bytes[i] % 10];
  }
  return code;
}

/**
 * Hash a string using SHA-256
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Sanitize user input for safe display
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
