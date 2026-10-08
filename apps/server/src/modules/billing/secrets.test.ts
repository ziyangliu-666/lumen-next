import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import { SecretCipher } from './secretCipher.js';
import { Secrets } from './secrets.js';
import {
  createBillingSlice,
  eraseAccountSecrets,
  removeOwnOpenAiKey,
  type WithActiveSecretAccount,
} from './index.js';
import { forbidden } from '../../core/http/httpError.js';
import { composeApp } from '../../app.js';

const owner = randomUUID();
const other = randomUUID();
const first = 'synthetic-first-token';
const replacement = 'synthetic-replacement-token';
const key = randomBytes(32);
const cipher = new SecretCipher('initial', new Map([['initial', key]]));

describe.skipIf(!TEST_DATABASE_URL)(
  'billing: encrypted secret persistence, not composed at runtime',
  () => {
    let db: Db;
    let drop: () => Promise<void>;
    let store: Secrets;
    const withActiveAccount: WithActiveSecretAccount = (accountId, work) =>
      db.withTransaction(async (tx) => {
        // Contract fixture only: real identity lock ordering is integration acceptance in #80.
        if (!(await canUse(accountId))) throw forbidden('account cannot use keys');
        return work(tx);
      });
    const remove = (id: string): Promise<void> =>
      db.withTransaction((tx) => removeOwnOpenAiKey(id, tx));
    const canUse = vi.fn<(id: string) => Promise<boolean>>();
    beforeEach(async () => {
      ({ db, drop } = await openTestDb());
      canUse.mockReset().mockResolvedValue(true);
      store = new Secrets(cipher, withActiveAccount);
    });
    afterEach(async () => {
      await drop?.();
    });

    it('stores only ciphertext, persists across recreation and replaces one owned row', async () => {
      expect(await store.secret(owner, 'openai')).toBeNull();
      await store.put(owner, 'openai', first);
      const rows = await db.query('select * from billing_secrets');
      expect(JSON.stringify(rows)).not.toContain(first);
      expect(rows).toHaveLength(1);
      const metadata = await store.list(owner);
      expect(metadata).toHaveLength(1);
      expect(Object.keys(metadata[0]!).sort()).toEqual(['provider', 'updatedAt']);
      expect(metadata[0]!.provider).toBe('openai');
      expect(Number.isNaN(Date.parse(metadata[0]!.updatedAt))).toBe(false);
      expect(await new Secrets(cipher, withActiveAccount).secret(owner, 'openai')).toBe(first);
      expect(await store.secret(other, 'openai')).toBeNull();
      expect(await store.list(other)).toEqual([]);
      await store.put(owner, 'openai', replacement);
      expect(await store.secret(owner, 'openai')).toBe(replacement);
      expect(
        await db.query('select 1 from billing_secrets where account_id = $1', [owner]),
      ).toHaveLength(1);
      await remove(other);
      expect(await store.secret(owner, 'openai')).toBe(replacement);
      await remove(owner);
      await remove(owner);
      expect(await store.secret(owner, 'openai')).toBeNull();
    });
    it('keeps one decryptable row across concurrent replacements and supports rotation', async () => {
      await Promise.all([first, replacement].map((value) => store.put(owner, 'openai', value)));
      expect([first, replacement]).toContain(await store.secret(owner, 'openai'));
      const next = randomBytes(32);
      const rotated = new Secrets(
        new SecretCipher(
          'next',
          new Map([
            ['initial', key],
            ['next', next],
          ]),
        ),
        withActiveAccount,
      );
      expect([first, replacement]).toContain(await rotated.secret(owner, 'openai'));
      await rotated.put(owner, 'openai', replacement);
      expect(await db.query('select key_id from billing_secrets')).toEqual([{ key_id: 'next' }]);
      expect(
        await new Secrets(
          new SecretCipher('next', new Map([['next', next]])),
          withActiveAccount,
        ).secret(owner, 'openai'),
      ).toBe(replacement);
      await expect(store.secret(owner, 'openai')).rejects.toThrow(
        'stored secret could not be decrypted',
      );
    });
    it('fails closed on ineligibility, unknown provider and an unavailable identity service', async () => {
      await store.put(owner, 'openai', first);
      for (const denied of [
        () => Promise.resolve(false),
        () => Promise.reject(new Error('identity unavailable')),
      ]) {
        canUse.mockImplementation(denied);
        await expect(store.secret(owner, 'openai')).rejects.toThrow();
        await expect(store.put(owner, 'openai', replacement)).rejects.toThrow();
        await expect(store.list(owner)).rejects.toThrow();
      }
      canUse.mockResolvedValue(true);
      await expect(store.put(owner, 'modal', first)).rejects.toMatchObject({ status: 400 });
      await expect(store.secret('not-an-id', 'openai')).rejects.toMatchObject({ status: 400 });
      expect(await store.secret(owner, 'openai')).toBe(first);
    });
    it('does not make removal depend on spending eligibility or touch another owner', async () => {
      await store.put(owner, 'openai', first);
      await store.put(other, 'openai', replacement);
      canUse.mockResolvedValue(false);
      await expect(store.secret(owner, 'openai')).rejects.toMatchObject({ status: 403 });
      canUse.mockClear();
      await remove(owner);
      await remove(owner);
      expect(canUse).not.toHaveBeenCalled();
      await expect(remove('invalid')).rejects.toMatchObject({ status: 400 });
      canUse.mockResolvedValue(true);
      expect(await store.secret(owner, 'openai')).toBeNull();
      expect(await store.secret(other, 'openai')).toBe(replacement);
    });

    it('does not return absence when stored ciphertext is corrupt or moved between owners', async () => {
      await store.put(owner, 'openai', first);
      await db.query(
        'insert into billing_secrets (account_id, provider, envelope) select $1, provider, envelope from billing_secrets where account_id = $2',
        [other, owner],
      );
      await expect(store.secret(other, 'openai')).rejects.toThrow(
        'stored secret could not be decrypted',
      );
      await db.query(
        "update billing_secrets set envelope = jsonb_set(envelope, '{tag}', '\"invalid\"') where account_id = $1",
        [owner],
      );
      await expect(store.secret(owner, 'openai')).rejects.toThrow(
        'stored secret could not be decrypted',
      );
    });
    it('offers a transaction-bound erase primitive without enabling a deletion hook', async () => {
      await store.put(owner, 'openai', first);
      await store.put(other, 'openai', replacement);
      await expect(
        db.withTransaction(async (tx) => {
          await eraseAccountSecrets(owner, tx);
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(await store.secret(owner, 'openai')).toBe(first);
      await db.withTransaction((tx) => eraseAccountSecrets(owner, tx));
      expect(await store.secret(owner, 'openai')).toBeNull();
      expect(await store.secret(other, 'openai')).toBe(replacement);
      await expect(eraseAccountSecrets('invalid', db)).rejects.toMatchObject({ status: 400 });
    });
    it('does not commit a save if the enclosing account transaction rolls back', async () => {
      const rollback: WithActiveSecretAccount = (id, work) =>
        db.withTransaction(async (tx) => {
          expect(id).toBe(owner);
          await work(tx);
          throw new Error('identity transaction rolled back');
        });
      const isolated = new Secrets(cipher, rollback);
      await expect(isolated.put(owner, 'openai', first)).rejects.toThrow(
        'identity transaction rolled back',
      );
      expect(await store.secret(owner, 'openai')).toBeNull();
    });
    it('does not return plaintext if the enclosing account transaction cannot commit', async () => {
      await store.put(owner, 'openai', first);
      const failCommit: WithActiveSecretAccount = async (id, work) => {
        await withActiveAccount(id, work);
        throw new Error('commit failed');
      };
      await expect(new Secrets(cipher, failCommit).secret(owner, 'openai')).rejects.toThrow(
        'commit failed',
      );
    });
    it('rolls back action-specific removal and needs no keyring to erase corrupt ciphertext', async () => {
      await store.put(owner, 'openai', first);
      await expect(
        db.withTransaction(async (tx) => {
          await removeOwnOpenAiKey(owner, tx);
          throw new Error('rollback removal');
        }),
      ).rejects.toThrow('rollback removal');
      expect(await store.secret(owner, 'openai')).toBe(first);
      await db.query(
        "update billing_secrets set envelope = jsonb_set(envelope, '{tag}', '\"broken\"') where account_id = $1",
        [owner],
      );
      await db.withTransaction((tx) => eraseAccountSecrets(owner, tx));
      expect(
        await db.query('select 1 from billing_secrets where account_id = $1', [owner]),
      ).toEqual([]);
    });
    it('keeps public runtime storage off until the deletion lifecycle is agreed', async () => {
      expect(createBillingSlice({ db })).not.toHaveProperty('secret');
      const app = await composeApp({ db, identity: null, logLevel: 'silent' });
      try {
        for (const method of ['GET', 'PUT', 'DELETE'] as const) {
          const response = await app.server.inject({
            method,
            url: method === 'GET' ? '/api/keys' : '/api/keys/openai',
            headers: { authorization: 'stub account:user' },
          });
          expect(response.statusCode).toBe(404);
        }
        expect(await db.query('select 1 from billing_secrets')).toEqual([]);
      } finally {
        await app.server.close();
      }
    });
  },
);
