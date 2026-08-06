import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM at-rest encryption for sensitive fields (client credential
 * secrets). No dedicated encryption-key env var exists (and this app can't
 * set new Vercel env vars for itself), so the key is derived from
 * JWT_REFRESH_SECRET — already required, already present in every
 * environment, and unrelated in purpose to the access-token secret so a
 * leaked access-token secret alone doesn't also expose this key.
 */
function encryptionKey(): Buffer {
  const material = process.env.JWT_REFRESH_SECRET;
  if (!material) throw new Error('JWT_REFRESH_SECRET is required to encrypt credential secrets');
  return createHash('sha256').update(`ayv-os:credential-secret:${material}`).digest();
}

/** Returns `iv:authTag:ciphertext`, all base64 — safe to store in a single text column. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted secret');

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
