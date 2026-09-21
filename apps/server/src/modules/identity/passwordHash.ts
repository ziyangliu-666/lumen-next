import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// v1 fixes the work factors: stored text cannot request attacker-chosen work.
// N=2^15, r=8, p=3; 16-byte random salt and 64-byte digest. Changing the factors
// requires a new format version and a migration/rehash policy.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const FORMAT = /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

/** Used only to spend equivalent hash work when no password credential exists. */
export const DUMMY_PASSWORD_HASH = `scrypt$v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

/** Resource bound, not the signup password-strength policy. */
export function isBoundedPassword(password: string): boolean {
  const bytes = Buffer.byteLength(password, 'utf8');
  return bytes > 0 && bytes <= 1024;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!isBoundedPassword(password)) {
    throw new Error('Password must contain 1 to 1024 UTF-8 bytes');
  }
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$v1$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!isBoundedPassword(password)) return false;
  const match = FORMAT.exec(storedHash);
  if (!match || match[0] !== storedHash) return false;
  const salt = Buffer.from(match[1]!, 'hex');
  const expected = Buffer.from(match[2]!, 'hex');
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
