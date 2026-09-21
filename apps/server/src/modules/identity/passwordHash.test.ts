import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from './passwordHash.js';

describe('identity: password hashing', () => {
  it('stores a salted scrypt digest rather than the password', async () => {
    const first = await hashPassword('a sufficiently long password');
    const second = await hashPassword('a sufficiently long password');
    expect(first).toMatch(/^scrypt\$v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(first).not.toEqual(second);
    expect(first).not.toContain('a sufficiently long password');
    await expect(verifyPassword('a sufficiently long password', first)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', first)).resolves.toBe(false);
  });

  it('preserves whitespace and Unicode in passwords', async () => {
    const hash = await hashPassword('  a secret 🔑  ');
    await expect(verifyPassword('  a secret 🔑  ', hash)).resolves.toBe(true);
    await expect(verifyPassword('a secret 🔑', hash)).resolves.toBe(false);
  });

  it.each([
    '',
    'plaintext',
    'scrypt$v2$bad$bad',
    'scrypt$v1$00$00',
    `${DUMMY_PASSWORD_HASH}$extra`,
    `${DUMMY_PASSWORD_HASH}\n`,
  ])('rejects malformed stored hashes: %s', async (hash) => {
    await expect(verifyPassword('a password', hash)).resolves.toBe(false);
  });

  it('bounds password bytes before invoking scrypt', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password must contain 1 to 1024 UTF-8 bytes');
    await expect(hashPassword('🔑'.repeat(257))).rejects.toThrow('Password must contain');
    await expect(verifyPassword('', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword('x'.repeat(1025), DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });

  it('accepts the byte ceiling', async () => {
    const password = 'x'.repeat(1024);
    const hash = await hashPassword(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it('can run the same derivation for a missing account without authenticating it', async () => {
    await expect(verifyPassword('an arbitrary password', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
