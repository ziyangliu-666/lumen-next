import { createHash } from 'node:crypto';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { AuthSessions, type NewAuthSession, type StoredAuthSession } from './authSessions.js';

const principal = { accountId: 'account-1', role: 'user' as const };
const token = Buffer.alloc(32, 1).toString('base64url');
const digest = createHash('sha256').update(token).digest('hex');
const now = 1000;
const valid: StoredAuthSession = { principal, suspended: false, expiresAt: 2000 };

interface Fixture {
  sessions: AuthSessions;
  store: {
    insert: Mock<(record: NewAuthSession) => Promise<void>>;
    findByTokenHash: Mock<(hash: string) => Promise<StoredAuthSession | null>>;
    deleteByTokenHash: Mock<(hash: string) => Promise<void>>;
    deleteByAccountId: Mock<(id: string) => Promise<void>>;
  };
}

function setup(record: StoredAuthSession | null = valid): Fixture {
  const store = {
    insert: vi.fn<(record: NewAuthSession) => Promise<void>>().mockResolvedValue(undefined),
    findByTokenHash: vi
      .fn<(hash: string) => Promise<StoredAuthSession | null>>()
      .mockResolvedValue(record),
    deleteByTokenHash: vi.fn<(hash: string) => Promise<void>>().mockResolvedValue(undefined),
    deleteByAccountId: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
  return { store, sessions: new AuthSessions(store, { lifetimeMs: 1000, now: () => now }) };
}

describe('identity: login sessions', () => {
  it('issues random tokens but persists only their hashes', async () => {
    const { sessions, store } = setup();
    const first = await sessions.issue(principal);
    const second = await sessions.issue(principal);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toEqual(second.token);
    expect(first.principal).toEqual(principal);
    expect(first.expiresAt).toBe(2000);
    expect(store.insert).toHaveBeenNthCalledWith(1, {
      accountId: principal.accountId,
      tokenHash: createHash('sha256').update(first.token).digest('hex'),
      createdAt: now,
      expiresAt: 2000,
    });
    expect(JSON.stringify(store.insert.mock.calls)).not.toContain(first.token);
  });

  it('looks up the hash and returns the current stored principal without issuing', async () => {
    const { sessions, store } = setup();
    await expect(sessions.verify(token)).resolves.toEqual(principal);
    expect(store.findByTokenHash).toHaveBeenCalledWith(digest);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    {},
    '',
    'stub account-1:staff',
    'x'.repeat(44),
    '!'.repeat(43),
    `${token.slice(0, -1)}F`,
    `${token}\n`,
  ])('rejects malformed or noncanonical tokens before lookup: %j', async (input) => {
    const { sessions, store } = setup();
    await expect(sessions.verify(input)).resolves.toBeNull();
    expect(store.findByTokenHash).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...valid, suspended: true },
    { ...valid, expiresAt: now },
    { ...valid, expiresAt: now - 1 },
    { ...valid, expiresAt: NaN },
    { ...valid, expiresAt: Infinity },
  ])('rejects unavailable, suspended or expired sessions: %j', async (record) => {
    const { sessions } = setup(record);
    await expect(sessions.verify(token)).resolves.toBeNull();
  });

  it('reads role changes from storage on every verification', async () => {
    const { sessions, store } = setup();
    await expect(sessions.verify(token)).resolves.toEqual(principal);
    store.findByTokenHash.mockResolvedValue({
      ...valid,
      principal: { ...principal, role: 'staff' },
    });
    await expect(sessions.verify(token)).resolves.toEqual({ ...principal, role: 'staff' });
  });

  it('revokes one session by hash and all sessions by account id', async () => {
    const { sessions, store } = setup();
    await sessions.revoke(token);
    expect(store.deleteByTokenHash).toHaveBeenCalledWith(digest);
    await sessions.revokeAll(principal.accountId);
    expect(store.deleteByAccountId).toHaveBeenCalledWith(principal.accountId);
    store.findByTokenHash.mockResolvedValue(null);
    await expect(sessions.verify(token)).resolves.toBeNull();
  });

  it('does not query storage when signing out with a malformed token', async () => {
    const { sessions, store } = setup();
    await sessions.revoke(undefined);
    expect(store.deleteByTokenHash).not.toHaveBeenCalled();
  });

  it('does not return a token when persistence fails', async () => {
    const { sessions, store } = setup();
    const failure = new Error('database unavailable');
    store.insert.mockRejectedValueOnce(failure);
    await expect(sessions.issue(principal)).rejects.toBe(failure);
  });

  it('propagates lookup and revocation failures', async () => {
    const { sessions, store } = setup();
    const failure = new Error('database unavailable');
    store.findByTokenHash.mockRejectedValueOnce(failure);
    store.deleteByTokenHash.mockRejectedValueOnce(failure);
    store.deleteByAccountId.mockRejectedValueOnce(failure);
    await expect(sessions.verify(token)).rejects.toBe(failure);
    await expect(sessions.revoke(token)).rejects.toBe(failure);
    await expect(sessions.revokeAll(principal.accountId)).rejects.toBe(failure);
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'refuses an invalid lifetime: %s',
    (lifetimeMs) => {
      const { store } = setup();
      expect(() => new AuthSessions(store, { lifetimeMs })).toThrow('Invalid session lifetime');
    },
  );

  it('uses wall-clock time when no clock is supplied', async () => {
    const { store } = setup();
    const sessions = new AuthSessions(store, { lifetimeMs: 1000 });
    const before = Date.now();
    const issued = await sessions.issue(principal);
    expect(issued.expiresAt).toBeGreaterThanOrEqual(before + 1000);
    expect(issued.expiresAt).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('fails closed on an invalid clock or unsafe expiry arithmetic', async () => {
    const { store } = setup();
    const invalidClock = new AuthSessions(store, { lifetimeMs: 1000, now: () => NaN });
    const overflow = new AuthSessions(store, {
      lifetimeMs: 1000,
      now: () => Number.MAX_SAFE_INTEGER,
    });
    await expect(invalidClock.issue(principal)).rejects.toThrow('Invalid session timestamp');
    await expect(invalidClock.verify(token)).rejects.toThrow('Invalid session timestamp');
    await expect(overflow.issue(principal)).rejects.toThrow('Invalid session timestamp');
    expect(store.insert).not.toHaveBeenCalled();
  });
});
