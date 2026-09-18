// Local-only composition root. Never imported by main.ts or the public index.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rmdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createIdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { localRoleProbe } from './localRoleProbe.js';
import { localOAuthProviders } from './localOAuth.js';
import { localMailSender } from './localMail.js';
import { readLocalBaseSchema } from './localSchema.js';

interface EngineSql {
  query<Row extends object>(sql: string, values: unknown[]): Promise<{ rows: Row[] }>;
  exec(sql: string): Promise<unknown>;
}
interface Engine extends EngineSql {
  transaction<T>(work: (tx: EngineSql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function sqlPort(engine: EngineSql): IdentitySql {
  return {
    query: async <Row extends object>(sql: string, values: readonly unknown[]): Promise<Row[]> =>
      (await engine.query<Row>(sql, [...values])).rows,
  };
}

async function start(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('The PGlite entry point is for local development only');
  }
  // Resolve from the compiled file, not the caller's working directory.
  const root = fileURLToPath(new URL('../../../../../', import.meta.url));
  const scratch = resolve(root, 'tmp');
  await mkdir(scratch, { recursive: true });
  const lock = resolve(scratch, 'identity-local-db.lock');
  // PGlite is single-process. Never allow two servers to open this directory.
  await mkdir(lock);
  let engine: Engine | undefined;
  try {
    const modulePath =
      process.env['IDENTITY_PGLITE_MODULE'] ??
      resolve(scratch, 'identity-tools/node_modules/@electric-sql/pglite/dist/index.js');
    const loaded = (await import(pathToFileURL(modulePath).href)) as {
      PGlite: new (directory: string) => Engine;
    };
    engine = new loaded.PGlite(resolve(scratch, 'identity-local-db'));
    const base = await readLocalBaseSchema();
    const identity = await readFile(
      resolve(root, 'apps/server/src/modules/identity/migrations/002_identity_auth.sql'),
      'utf8',
    );
    const fingerprint = createHash('sha256').update(base).update(identity).digest('hex');
    // This is a fixed local fixture bootstrap, not the production migration runner.
    // Refuse changed schemas rather than silently hiding incompatible local data.
    await engine.transaction(async (tx) => {
      await tx.exec('create table if not exists local_identity_setup (fingerprint text not null)');
      const { rows } = await tx.query<{ fingerprint: string }>(
        'select fingerprint from local_identity_setup',
        [],
      );
      if (rows.length === 0) {
        await tx.exec(base);
        await tx.exec(identity);
        await tx.query('insert into local_identity_setup values ($1)', [fingerprint]);
      } else if (rows.length !== 1 || rows[0]?.fingerprint !== fingerprint) {
        throw new Error('Local schema changed; back up and reset tmp/identity-local-db explicitly');
      }
    });
    for (const [file, table] of [
      ['003_identity_oauth.sql', 'local_identity_oauth_setup'],
      ['004_identity_mail.sql', 'local_identity_mail_setup'],
    ] as const) {
      const sql = await readFile(
        resolve(root, 'apps/server/src/modules/identity/migrations', file),
        'utf8',
      );
      const digest = createHash('sha256').update(sql).digest('hex');
      await engine.transaction(async (tx) => {
        // Identifiers are a fixed local fixture list, never user input.
        await tx.exec(`create table if not exists ${table} (fingerprint text not null)`);
        const { rows } = await tx.query<{ fingerprint: string }>(
          `select fingerprint from ${table}`,
          [],
        );
        if (!rows.length) {
          await tx.exec(sql);
          await tx.query(`insert into ${table} values ($1)`, [digest]);
        } else if (rows.length !== 1 || rows[0]?.fingerprint !== digest) {
          throw new Error('Local identity schema changed; explicit migration/reset required');
        }
      });
    }
    const providers = await localOAuthProviders(resolve(scratch, 'identity-tools'));
    const db = engine;
    const database: IdentityDatabase = {
      ...sqlPort(db),
      withTransaction: (work) => db.transaction((tx) => work(sqlPort(tx))),
    };
    // Explicit local fixture setup only: never accept a role from signup or HTTP.
    const staffEmail = process.env['LOCAL_IDENTITY_STAFF_EMAIL'];
    if (staffEmail !== undefined) {
      const promoted = await database.query<{ id: string }>(
        "update accounts set role = 'staff' where email = $1 and not suspended returning id",
        [staffEmail.trim().toLowerCase()],
      );
      if (promoted.length !== 1) throw new Error('Register the active local test account first');
      console.info('Promoted the explicitly selected local test account to staff');
    }
    const slice = createIdentitySlice({
      database,
      origin: 'http://localhost:4000',
      secureCookies: false,
      sessionLifetimeMs: 24 * 60 * 60 * 1000,
      loginGate: new LoginGate(),
      oauthProviders: providers,
      mailSender: localMailSender(scratch),
      mailDeliveryFailed: () =>
        console.warn('Identity mail delivery failed; check transport configuration'),
    });
    const app = await buildServer({
      broker: new Broker(),
      resolver: slice.principalResolver,
      // This harness exposes identity only, not research sessions or a fake WS identity.
      access: { canWatch: () => Promise.resolve(false) },
      webRoot: resolve(root, 'apps/web/dist'),
      logLevel: 'warn',
    });
    app.addHook('onClose', async () => {
      await db.close();
      await rmdir(lock);
    });
    try {
      await app.register(slice.registerRoutes);
      await app.register(localRoleProbe);
      app.get('/api/health', () => ({ status: 'ok', mode: 'local-identity-pglite' }));
      await app.listen({ port: 4000, host: '127.0.0.1' });
    } catch (error) {
      await app.close();
      engine = undefined;
      throw error;
    }
    let closing = false;
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        if (closing) return;
        closing = true;
        app.close().catch((error: unknown) => {
          console.error('Local identity shutdown failed', error);
          process.exitCode = 1;
        });
      });
    }
    console.info('Local identity: http://localhost:4000/#/signin (PGlite; not for deployment)');
  } catch (error) {
    if (engine) await engine.close();
    await rmdir(lock).catch(() => undefined);
    throw error;
  }
}

start().catch((error: unknown) => {
  console.error('Local identity startup failed', error);
  process.exitCode = 1;
});
