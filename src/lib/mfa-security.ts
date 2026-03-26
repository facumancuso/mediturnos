import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const rawKey = process.env.MFA_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('Falta MFA_ENCRYPTION_KEY para cifrar secretos MFA.');
  }

  const keyBuffer = Buffer.from(rawKey, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY debe ser base64 de 32 bytes.');
  }

  return keyBuffer;
}

function getBackupPepper() {
  return process.env.MFA_BACKUP_PEPPER || 'default-dev-pepper-change-me';
}

export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encryptedB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Payload cifrado inválido para secreto MFA.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function generateBackupCodes(amount = 10): string[] {
  return Array.from({ length: amount }, () => randomBytes(4).toString('hex').toUpperCase());
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(`${code}:${getBackupPepper()}`).digest('hex');
}
