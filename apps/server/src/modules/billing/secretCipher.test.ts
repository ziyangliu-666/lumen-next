import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { expect, it } from 'vitest';
import { SecretCipher } from './secretCipher.js';

const context = { accountId: '10000000-0000-4000-8000-000000000001', provider: 'anthropic' };
const plaintext = 'synthetic-key-for-tests-only';
const key = randomBytes(32);
const keys = new Map([['first', key]]);
const cipher = new SecretCipher('first', keys);

it('authenticates a persisted envelope after recreating the cipher without storing plaintext', () => {
  const first = cipher.seal(context, plaintext);
  const second = cipher.seal(context, plaintext);
  expect(first.nonce).not.toBe(second.nonce);
  expect(first.ciphertext).not.toBe(second.ciphertext);
  const stored: unknown = JSON.parse(JSON.stringify(first));
  expect(new SecretCipher('first', keys).open(context, stored)).toBe(plaintext);
  expect(JSON.stringify(first)).not.toContain(plaintext);
  expect(Object.keys(first).sort()).toEqual(['ciphertext', 'keyId', 'nonce', 'tag', 'version']);
});
it('cannot move a stored secret to another owner or provider', () => {
  const envelope = cipher.seal(context, plaintext);
  for (const other of [
    { ...context, accountId: '20000000-0000-4000-8000-000000000002' },
    { ...context, provider: 'tavily' },
  ])
    expect(() => cipher.open(other, envelope)).toThrow('stored secret could not be decrypted');
});
it.each(['nonce', 'ciphertext', 'tag'] as const)(
  'rejects tampering with %s before returning any plaintext',
  (field) => {
    const envelope = cipher.seal(context, plaintext);
    const bytes = Buffer.from(envelope[field], 'base64');
    bytes[0] = bytes[0]! ^ 1;
    expect(() => cipher.open(context, { ...envelope, [field]: bytes.toString('base64') })).toThrow(
      'stored secret could not be decrypted',
    );
  },
);
it('supports a new active key while retaining old decryption keys', () => {
  const old = cipher.seal(context, plaintext);
  const nextKey = randomBytes(32);
  const rotated = new SecretCipher(
    'next',
    new Map([
      ['first', key],
      ['next', nextKey],
    ]),
  );
  expect(rotated.open(context, old)).toBe(plaintext);
  const next = rotated.seal(context, plaintext);
  expect(next.keyId).toBe('next');
  expect(new SecretCipher('next', new Map([['next', nextKey]])).open(context, next)).toBe(
    plaintext,
  );
  expect(() => new SecretCipher('next', new Map([['next', nextKey]])).open(context, old)).toThrow(
    'stored secret could not be decrypted',
  );
  // Even identical key material under another ID cannot relabel an envelope.
  const alias = new SecretCipher('alias', new Map([['alias', key]]));
  expect(() => alias.open(context, { ...old, keyId: 'alias' })).toThrow(
    'stored secret could not be decrypted',
  );
});
it('copies input key material and keeps it out of JSON and object inspection', () => {
  const input = randomBytes(32);
  const encoded = input.toString('hex');
  const local = new SecretCipher('key', new Map([['key', input]]));
  const stored = local.seal(context, plaintext);
  input.fill(0);
  expect(local.open(context, stored)).toBe(plaintext);
  expect(JSON.stringify(local)).toBe('{}');
  expect(inspect(local)).not.toContain(encoded);
});
it('bounds values by UTF-8 bytes, preserves whitespace, and rejects empty values', () => {
  for (const value of ['  token  ', '\uFEFFtoken', 'x'.repeat(16384), 'é'.repeat(8192)]) {
    expect(cipher.open(context, cipher.seal(context, value))).toBe(value);
  }
  for (const value of ['', '   ', '\ud800', 'x'.repeat(16385), 'é'.repeat(8193)]) {
    expect(() => cipher.seal(context, value)).toThrow('invalid secret value');
  }
});
it('rejects bad configuration and contexts without echoing their values', () => {
  for (const [active, ring] of [
    ['missing', keys],
    ['bad id', new Map([['bad id', key]])],
    ['first', new Map([['first', randomBytes(31)]])],
    [
      'first',
      new Map([
        ['first', key],
        ['bad id', key],
      ]),
    ],
  ] as const)
    expect(() => new SecretCipher(active, ring)).toThrow('invalid secret encryption configuration');
  for (const invalid of [
    { ...context, accountId: 'invalid' },
    { ...context, provider: 'Invalid provider' },
  ])
    expect(() => cipher.seal(invalid, plaintext)).toThrow('invalid secret context');
});
it('rejects malformed, unsupported and noncanonical envelopes with a value-free error', () => {
  const envelope = cipher.seal(context, plaintext);
  for (const invalid of [
    null,
    {},
    'text',
    { ...envelope, version: 2 },
    { ...envelope, keyId: 1 },
    { ...envelope, keyId: 'unknown' },
    { ...envelope, nonce: '' },
    { ...envelope, nonce: Buffer.alloc(11).toString('base64') },
    { ...envelope, tag: 123 },
    { ...envelope, tag: Buffer.alloc(15).toString('base64') },
    { ...envelope, ciphertext: envelope.ciphertext + '\n' },
    { ...envelope, ciphertext: 'A'.repeat(22000) },
  ])
    expect(() => cipher.open(context, invalid)).toThrow('stored secret could not be decrypted');
});
