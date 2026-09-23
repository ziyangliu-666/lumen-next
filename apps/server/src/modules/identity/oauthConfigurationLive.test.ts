import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createIdentitySlice, LoginGate, oauthProvidersFromEnvironment } from './index.js';

const origin = 'https://lumen.example';

describe.skipIf(!TEST_DATABASE_URL)(
  'identity: configured Arctic providers with PostgreSQL routes',
  () => {
    let fixture: Awaited<ReturnType<typeof openTestDb>>;
    let app: FastifyInstance;
    const network = vi.fn<typeof fetch>();
    beforeAll(async () => {
      fixture = await openTestDb();
    }, 60_000);
    beforeEach(async () => {
      network.mockReset();
      vi.stubGlobal('fetch', network);
      const identity = createIdentitySlice({
        database: fixture.db,
        origin,
        sessionLifetimeMs: 60_000,
        loginGate: new LoginGate(),
        oauthProviders: oauthProvidersFromEnvironment(
          {
            GITHUB_OAUTH_CLIENT_ID: 'github-client',
            GITHUB_OAUTH_CLIENT_SECRET: 'private-github-secret',
            GOOGLE_OAUTH_CLIENT_ID: 'google-client',
            GOOGLE_OAUTH_CLIENT_SECRET: 'private-google-secret',
          },
          origin,
        ),
      });
      app = await buildServer({
        broker: new Broker(),
        resolver: identity.principalResolver,
        access: { canWatch: () => Promise.resolve(false) },
        logLevel: 'silent',
      });
      await app.register(identity.registerRoutes);
    });
    afterEach(async () => {
      await app?.close();
      vi.unstubAllGlobals();
    });
    afterAll(async () => {
      await fixture?.drop();
    });

    it('advertises exactly the injected providers, not mail', async () => {
      expect((await app.inject('/api/auth/providers')).json()).toEqual({
        github: true,
        google: true,
      });
      expect((await app.inject('/api/auth/mail')).json()).toEqual({ enabled: false });
      expect(network).not.toHaveBeenCalled();
    });

    it.each(['github', 'google'] as const)(
      'starts %s with a fixed callback and consumes cancellation once',
      async (kind) => {
        const started = await app.inject(`/api/auth/${kind}`);
        expect(started.statusCode).toBe(302);
        const redirect = new URL(String(started.headers.location));
        expect(redirect.origin).toBe(
          kind === 'github' ? 'https://github.com' : 'https://accounts.google.com',
        );
        expect(redirect.searchParams.get('redirect_uri')).toBe(
          `${origin}/api/auth/${kind}/callback`,
        );
        expect(redirect.href).not.toContain('private-');
        expect(
          await fixture.db.query(
            'select provider from identity_oauth_attempts where provider = $1',
            [kind],
          ),
        ).toEqual([{ provider: kind }]);
        const state = redirect.searchParams.get('state');
        expect(state).toBeTruthy();
        expect(String(started.headers['set-cookie'])).toContain('HttpOnly');
        expect(String(started.headers['set-cookie'])).toContain('Secure');
        expect(String(started.headers['set-cookie'])).toContain(`Path=/api/auth/${kind}/callback`);
        const binding = started.cookies.find((cookie) => cookie.name === `lumen_oauth_${kind}`);
        expect(binding).toBeDefined();
        const url = `/api/auth/${kind}/callback?state=${encodeURIComponent(state!)}&error=access_denied`;
        const cancelled = await app.inject({
          url,
          cookies: { [`lumen_oauth_${kind}`]: binding!.value },
        });
        expect(
          await fixture.db.query(
            'select provider from identity_oauth_attempts where provider = $1',
            [kind],
          ),
        ).toEqual([]);
        expect(cancelled.statusCode).toBe(302);
        expect(cancelled.headers.location).toBe('/?authError=oauth_failed#/signin');
        const replay = await app.inject({
          url,
          cookies: { [`lumen_oauth_${kind}`]: binding!.value },
        });
        expect(replay.headers.location).toBe('/?authError=oauth_failed#/signin');
        expect((await app.inject('/api/me')).statusCode).toBe(401);
        expect(network).not.toHaveBeenCalled();
      },
    );
  },
);
