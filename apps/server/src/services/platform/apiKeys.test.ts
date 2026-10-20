import { describe, expect, it, vi } from 'vitest';
import type { Principal, PrincipalResolver } from '../../core/http/authGuard.js';
import {
  base62,
  bearerKey,
  generateKey,
  hashKey,
  isKeyFormat,
  withApiKeys,
  type ActiveKey,
  type ApiKeyStore,
} from './apiKeys.js';

const OWNER = '00000000-0000-4000-8000-000000000001';

/** A store that knows the keys it is given, by hash. */
function fakeKeyStore(
  live: Record<string, Partial<ActiveKey>> = {},
): ApiKeyStore & { touched: string[] } {
  const touched: string[] = [];
  return {
    touched,
    create: () => Promise.reject(new Error('not used')),
    list: () => Promise.resolve([]),
    revoke: () => Promise.resolve(false),
    findActive: (hash) => {
      const entry = Object.entries(live).find(([key]) => hashKey(key) === hash);
      if (!entry) return Promise.resolve(null);
      return Promise.resolve({
        id: 'key-1',
        accountId: OWNER,
        name: 'test',
        prefix: entry[0].slice(4, 12),
        scopes: [],
        createdAt: new Date(0).toISOString(),
        lastUsedAt: null,
        revokedAt: null,
        role: 'user',
        ...entry[1],
      });
    },
    touch: (id) => {
      touched.push(id);
      return Promise.resolve();
    },
  };
}

const cookieUser: Principal = { accountId: 'cookie-account', role: 'user' };
const cookies: PrincipalResolver = {
  resolve: (from) => Promise.resolve(from.cookies['lumen_session'] ? cookieUser : null),
};

describe('API key format', () => {
  it('is lmn_, an 8-character prefix and a 32-character secret, all base62', () => {
    const { key, prefix, hash } = generateKey();
    expect(key).toMatch(/^lmn_[0-9A-Za-z]{8}_[0-9A-Za-z]{32}$/);
    expect(key.slice(4, 12)).toBe(prefix);
    expect(isKeyFormat(key)).toBe(true);
    expect(hash).toBe(hashKey(key));
  });

  it('gives a different key each time', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateKey().key));
    expect(keys.size).toBe(50);
  });

  it('hashes the whole key with SHA-256, as lowercase hex', () => {
    expect(hashKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashKey(generateKey().key)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('drops random bytes at or over 248, so every character is equally likely', () => {
    const bytes = Buffer.from([255, 248, 0, 61, 62, 247]);
    const random = vi.fn(() => bytes);
    // 0 -> '0', 61 -> 'z', 62 -> '0', 247 -> 247 % 62 = 61 -> 'z'
    expect(base62(4, random)).toBe('0z0z');
  });

  it('reads a key only from a Bearer header that starts with lmn_', () => {
    expect(bearerKey('Bearer lmn_abc')).toBe('lmn_abc');
    expect(bearerKey('bearer lmn_abc')).toBe('lmn_abc');
    expect(bearerKey('Bearer something-else')).toBeNull();
    expect(bearerKey('stub a:user')).toBeNull();
    expect(bearerKey(undefined)).toBeNull();
  });
});

describe('withApiKeys', () => {
  const { key } = generateKey();

  it("resolves a live key to its account's principal, and remembers the key", async () => {
    const store = fakeKeyStore({ [key]: { scopes: ['agents:read'], role: 'staff' } });
    const resolver = withApiKeys(cookies, store);
    const principal = await resolver.resolve({ authorization: `Bearer ${key}`, cookies: {} });
    expect(principal).toEqual({ accountId: OWNER, role: 'staff' });
    expect(resolver.keyOf(principal)?.scopes).toEqual(['agents:read']);
  });

  it('sends a request without a key to the cookie resolver, and it carries no key', async () => {
    const resolver = withApiKeys(cookies, fakeKeyStore());
    const principal = await resolver.resolve({ cookies: { lumen_session: 'x' } });
    expect(principal).toBe(cookieUser);
    expect(resolver.keyOf(principal)).toBeNull();
  });

  it('never falls back to the cookie for an unknown, revoked or malformed key', async () => {
    const resolver = withApiKeys(cookies, fakeKeyStore());
    const withCookie = { cookies: { lumen_session: 'x' } };
    expect(await resolver.resolve({ ...withCookie, authorization: `Bearer ${key}` })).toBeNull();
    expect(await resolver.resolve({ ...withCookie, authorization: 'Bearer lmn_short' })).toBeNull();
  });

  it('touches last_used_at only when the stored time is a minute old or more', async () => {
    let now = Date.parse('2026-10-20T12:00:00Z');
    const recent = new Date(now - 30_000).toISOString();
    const store = fakeKeyStore({ [key]: { lastUsedAt: recent } });
    const resolver = withApiKeys(cookies, store, undefined, () => now);
    await resolver.resolve({ authorization: `Bearer ${key}`, cookies: {} });
    expect(store.touched).toEqual([]);
    now += 31_000;
    await resolver.resolve({ authorization: `Bearer ${key}`, cookies: {} });
    expect(store.touched).toEqual(['key-1']);
  });
});
