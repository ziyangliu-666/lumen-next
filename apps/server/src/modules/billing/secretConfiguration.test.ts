import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { secretCipherFromEnvironment } from './secretConfiguration.js';

const key = randomBytes(32).toString('base64');
const configuration = {
  BILLING_SECRET_KEYRING: JSON.stringify({ current: key }),
  BILLING_SECRET_ACTIVE_KEY_ID: 'current',
};
it('disables Keys when both configuration values are absent or empty', () => {
  expect(secretCipherFromEnvironment({})).toBeNull();
  expect(
    secretCipherFromEnvironment({ BILLING_SECRET_KEYRING: '', BILLING_SECRET_ACTIVE_KEY_ID: '' }),
  ).toBeNull();
});
it('constructs a usable cipher from an explicit keyring without retaining raw configuration', () => {
  const cipher = secretCipherFromEnvironment(configuration)!;
  const context = { accountId: '10000000-0000-4000-8000-000000000001', provider: 'openai' };
  expect(cipher.open(context, cipher.seal(context, 'synthetic test token'))).toBe(
    'synthetic test token',
  );
  expect(JSON.stringify(cipher)).toBe('{}');
});
it('rejects partial, malformed and noncanonical configuration with a value-free error', () => {
  const invalid = [
    { BILLING_SECRET_KEYRING: configuration.BILLING_SECRET_KEYRING },
    { BILLING_SECRET_ACTIVE_KEY_ID: 'current' },
    ...[
      ' ',
      'not-json',
      'null',
      '[]',
      '{}',
      '1',
      '"text"',
      'x'.repeat(16385),
      JSON.stringify({ current: 3 }),
      JSON.stringify({ current: key.trimEnd() + '\n' }),
      JSON.stringify({ current: 'A'.repeat(44) }),
      JSON.stringify({ other: key }),
      JSON.stringify({ 'bad id': key }),
      JSON.stringify({ current: key.replace(/=$/, '-') }),
    ].map((BILLING_SECRET_KEYRING) => ({ ...configuration, BILLING_SECRET_KEYRING })),
  ];
  for (const env of invalid) {
    expect(() => secretCipherFromEnvironment(env)).toThrow('invalid billing secret configuration');
    try {
      secretCipherFromEnvironment(env);
    } catch (error) {
      expect(String(error)).not.toContain(key);
      expect((error as Error).cause).toBeUndefined();
    }
  }
});
