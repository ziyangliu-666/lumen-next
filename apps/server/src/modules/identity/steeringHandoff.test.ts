import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireUser, type Principal } from '../../core/http/authGuard.js';
import { forbidden, notFound } from '../../core/http/httpError.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { parseCommand } from '../../core/protocol/parseCommand.js';
import { createIdentitySlice, type IdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { hashPassword } from './passwordHash.js';
import { PostgresAccountStore } from './postgresStores.js';
import { AUTH_COOKIE } from './sessionStrategy.js';

// Steering is not implemented on this branch. These test-only resource maps and
// handlers demonstrate the boundary, not real storage/upload/worker acceptance.
interface EngineSql {
  query<Row extends object>(text: string, values: unknown[]): Promise<{ rows: Row[] }>;
  exec(text: string): Promise<unknown>;
}
interface Engine extends EngineSql {
  transaction<T>(work: (tx: EngineSql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
function sqlPort(engine: EngineSql): IdentitySql {
  return {
    query: async <Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]> =>
      (await engine.query<Row>(text, [...values])).rows,
  };
}
const modulePath = process.env['IDENTITY_PGLITE_MODULE'];
const origin = 'https://lumen.example';
const password = 'steering handoff test password';

describe.skipIf(!modulePath)('identity: steering handoff with test-only resource handlers', () => {
  let engine: Engine;
  let database: IdentityDatabase;
  let app: FastifyInstance;
  let identity: IdentitySlice;
  let address: string;
  let ownerId: string;
  let otherId: string;
  let ownerCookie: string;
  let otherCookie: string;
  let passwordHash: string;
  const sockets: WebSocket[] = [];
  const observed: { accountId: string; allowed: boolean }[] = [];

  beforeAll(async () => {
    const loaded = (await import(pathToFileURL(modulePath!).href)) as {
      PGlite: new () => Engine;
    };
    engine = new loaded.PGlite();
    database = {
      ...sqlPort(engine),
      withTransaction: (work) => engine.transaction((tx) => work(sqlPort(tx))),
    };
    await engine.exec(await readFile(new URL('../../core/db/schema.sql', import.meta.url), 'utf8'));
    await engine.transaction(async (tx) => {
      await tx.exec(
        await readFile(new URL('./migrations/002_identity_auth.sql', import.meta.url), 'utf8'),
      );
    });
    passwordHash = await hashPassword(password);
  }, 60_000);

  beforeEach(async () => {
    observed.length = 0;
    await engine.exec('truncate accounts cascade');
    const store = new PostgresAccountStore(database);
    ownerId = (
      await store.createPasswordAccount({
        email: 'owner@example.test',
        displayName: 'Owner',
        passwordHash,
      })
    ).id;
    otherId = (
      await store.createPasswordAccount({
        email: 'other@example.test',
        displayName: 'Other',
        passwordHash,
      })
    ).id;
    identity = createIdentitySlice({
      database,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate({ attempts: 50 }),
    });
    const broker = new Broker();
    const sessionOwner = (id: string): string | undefined =>
      id === 'session-owner' ? ownerId : id === 'session-other' ? otherId : undefined;
    const projectOwner = (id: string): string | undefined =>
      id === 'project-owner' ? ownerId : id === 'project-other' ? otherId : undefined;
    function requireOwner(principal: Principal, expected: string | undefined): void {
      if (principal.accountId !== expected) throw notFound('no such resource');
    }
    app = await buildServer({
      broker,
      resolver: identity.principalResolver,
      logLevel: 'silent',
      access: {
        canWatch: (principal, id) => Promise.resolve(principal.accountId === sessionOwner(id)),
      },
    });
    await app.register(identity.registerRoutes);
    // The identity plugin's Origin hook is encapsulated: other slices need their own.
    app.get<{ Params: { id: string } }>('/api/projects/:id/files', (request) => {
      requireOwner(requireUser(request), projectOwner(request.params.id));
      return { fixtureOnly: true, files: [] };
    });
    app.post<{ Params: { id: string } }>('/api/sessions/:id/attach', (request, reply) => {
      const principal = requireUser(request);
      if (request.headers.origin !== origin) throw forbidden('Untrusted request origin');
      requireOwner(principal, sessionOwner(request.params.id));
      return reply.code(204).send();
    });
    broker.onCommand('task.steer', (command, principal) => {
      // A valid socket does not authorize arbitrary task IDs inside its frames.
      const expected =
        command.taskId === 'task-owner'
          ? ownerId
          : command.taskId === 'task-other'
            ? otherId
            : undefined;
      observed.push({ accountId: principal.accountId, allowed: principal.accountId === expected });
      // No actual steering side effect is performed in this fixture.
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    address = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/ws`;
    async function login(email: string): Promise<string> {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email, password },
      });
      expect(response.statusCode).toBe(200);
      return `${AUTH_COOKIE}=${response.cookies.find((cookie) => cookie.name === AUTH_COOKIE)!.value}`;
    }
    ownerCookie = await login('owner@example.test');
    otherCookie = await login('other@example.test');
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    await app?.close();
  });
  afterAll(async () => {
    await engine?.close();
  });

  function connect(session: string, cookie?: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${address}?session=${session}`, {
        headers: { origin, ...(cookie ? { cookie } : {}) },
        handshakeTimeout: 3000,
      });
      sockets.push(socket);
      socket.once('open', () => resolve(socket));
      socket.once('error', reject);
    });
  }

  it('passes real identity to file/attachment probes and requires resource ownership plus Origin', async () => {
    for (const [cookie, status] of [
      [undefined, 401],
      [otherCookie, 404],
      [ownerCookie, 200],
    ] as const) {
      const headers = cookie ? { cookie } : {};
      expect(
        (await app.inject({ url: '/api/projects/project-owner/files', headers })).statusCode,
      ).toBe(status);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/sessions/session-owner/attach',
            headers: { ...headers, origin },
          })
        ).statusCode,
      ).toBe(status === 200 ? 204 : status);
    }
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/sessions/session-owner/attach',
          headers: { cookie: ownerCookie, origin: 'https://untrusted.example' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: '/api/projects/project-owner/files',
          headers: { authorization: `stub ${ownerId}:staff` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: '/api/projects/project-missing/files',
          headers: { cookie: ownerCookie },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('rejects anonymous/foreign-session upgrades and supplies the cookie principal to task handlers', async () => {
    await expect(connect('session-owner')).rejects.toThrow(/401/);
    await expect(connect('session-owner', otherCookie)).rejects.toThrow(/404/);
    const socket = await connect('session-owner', ownerCookie);
    socket.send(
      JSON.stringify({
        type: 'task.steer',
        taskId: 'task-owner',
        text: 'test',
        when: 'next-step',
        accountId: otherId,
        role: 'staff',
      }),
    );
    socket.send(
      JSON.stringify({ type: 'task.steer', taskId: 'task-other', text: 'test', when: 'next-step' }),
    );
    await expect.poll(() => observed.length).toBe(2);
    expect(observed).toEqual([
      { accountId: ownerId, allowed: true },
      { accountId: ownerId, allowed: false },
    ]);
  });

  it('rejects fresh HTTP requests and socket connections after signout or suspension', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/signout',
          headers: { origin, cookie: ownerCookie },
        })
      ).statusCode,
    ).toBe(204);
    await expect(connect('session-owner', ownerCookie)).rejects.toThrow(/401/);
    await identity.suspend(otherId, true);
    await identity.suspend(otherId, false);
    await expect(connect('session-other', otherCookie)).rejects.toThrow(/401/);
    expect(
      (
        await app.inject({
          url: '/api/projects/project-other/files',
          headers: { cookie: otherCookie },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('documents the core gap: an open socket retains its handshake principal after suspension', async () => {
    const socket = await connect('session-owner', ownerCookie);
    await identity.suspend(ownerId, true);
    await expect(connect('session-owner', ownerCookie)).rejects.toThrow(/401/);
    socket.send(
      JSON.stringify({
        type: 'task.steer',
        taskId: 'task-owner',
        text: 'probe only',
        when: 'next-step',
      }),
    );
    await expect.poll(() => observed.length).toBe(1);
    // Characterization, NOT a security acceptance: core needs revocation/revalidation.
    expect(observed[0]).toEqual({ accountId: ownerId, allowed: true });
  });

  it('documents that steer.cancel is not supported by the current wire parser', () => {
    expect(parseCommand(JSON.stringify({ type: 'steer.cancel', steerId: 'fixture' }))).toBeNull();
  });
});
