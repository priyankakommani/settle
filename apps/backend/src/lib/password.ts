import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing with Node's built-in scrypt — no native dependency.
 * Stored format:  scrypt$<keylen>$<saltB64>$<hashB64>
 */
const scryptAsync = promisify(scrypt);
const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `scrypt$${KEYLEN}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;

  const keylen = Number(parts[1]);
  const salt = Buffer.from(parts[2]!, 'base64');
  const expected = Buffer.from(parts[3]!, 'base64');
  if (!Number.isInteger(keylen) || keylen <= 0 || expected.length !== keylen) return false;

  const derived = (await scryptAsync(plain, salt, keylen)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
