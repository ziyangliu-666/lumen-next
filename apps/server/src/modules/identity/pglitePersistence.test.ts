import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { AuthSessions } from './authSessions.js';
import { AccountService } from './accountService.js';
import { readLocalBaseSchema } from './localSchema.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { PasswordStrategy } from './passwordStrategy.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';

interface EngineSql {
  query<Row extends object>(text: string, values: unknown[]): Promise<{ rows: Row[] }>;
  exec(text: string): Promise<unknown>;
}
interface Engine extends EngineSql {
  transaction<T>(work: (tx: EngineSql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
function port(engine: EngineSql): IdentitySql {
  return {
    query: async <Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]> =>
      (await engine.query<Row>(text, [...values])).rows,
  };
}
function stores(engine: Engine): {
  accounts: PostgresAccountStore;
  sessions: AuthSessions;
} {
  const database: IdentityDatabase = {
    ...port(engine),
    withTransaction: (work) => engine.transaction((tx) => work(port(tx))),
  };
  return {
    accounts: new PostgresAccountStore(database),
    sessions: new AuthSessions(new PostgresAuthSessionStore(database), { lifetimeMs: 60_000 }),
  };
}

const modulePath = process.env['IDENTITY_PGLITE_MODULE'];
it.skipIf(!modulePath)(
  'identity: persists credentials, sessions and revocation across disk engine restarts',
  async () => {
    const loaded = (await import(pathToFileURL(modulePath!).href)) as {
      PGlite: new (directory: string) => Engine;
    };
    const directory = await mkdtemp(join(tmpdir(), 'lumen-identity-restart-'));
    let engine: Engine | undefined;
    try {
      const data = join(directory, 'data');
      engine = new loaded.PGlite(data);
      await engine.exec(await readLocalBaseSchema());
      await engine.transaction(async (tx) => {
        await tx.exec(
          await readFile(new URL('./migrations/002_identity_auth.sql', import.meta.url), 'utf8'),
        );
      });
      const first = stores(engine);
      const password = 'local persistence test password';
      const account = await new AccountService(first.accounts).signup({
        email: 'restart@example.test',
        displayName: 'Restart test',
        password,
      });
      const issued = await first.sessions.issue({ accountId: account.id, role: 'user' });
      await engine.close();
      engine = undefined;
      engine = new loaded.PGlite(data);
      const second = stores(engine);
      expect(await second.accounts.getAccount(account.id)).toMatchObject({
        email: 'restart@example.test',
      });
      expect(await second.sessions.verify(issued.token)).toEqual(issued.principal);
      expect(
        await new PasswordStrategy(second.accounts).verify({
          email: 'restart@example.test',
          password,
        }),
      ).toEqual({
        ...issued.principal,
        expectedPasswordHash: (await second.accounts.getPasswordAccount(account.id))?.passwordHash,
      });
      await second.sessions.revoke(issued.token);
      await engine.close();
      engine = undefined;
      engine = new loaded.PGlite(data);
      expect(await stores(engine).sessions.verify(issued.token)).toBeNull();
    } finally {
      if (engine) await engine.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
  60_000,
);
