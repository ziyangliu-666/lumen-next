import { SecretCipher } from './secretCipher.js';

/** Parse explicitly supplied server configuration; never read process.env or log values. */
export function secretCipherFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): SecretCipher | null {
  const raw = env['BILLING_SECRET_KEYRING'];
  const active = env['BILLING_SECRET_ACTIVE_KEY_ID'];
  if (!raw && !active) return null;
  try {
    if (!raw || !active || raw.length > 16384) throw new Error('incomplete configuration');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('invalid keyring');
    const keys = new Map<string, Uint8Array>();
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' || value.length !== 44) throw new Error('invalid key');
      const bytes = Buffer.from(value, 'base64');
      if (bytes.length !== 32 || bytes.toString('base64') !== value) throw new Error('invalid key');
      keys.set(id, bytes);
    }
    return new SecretCipher(active, keys);
  } catch {
    throw new Error('invalid billing secret configuration');
  }
}
