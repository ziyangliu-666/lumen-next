import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildServer } from '../../core/http/server.js';
import { headerStub } from '../../core/http/authGuard.js';
import { Broker } from '../../core/protocol/broker.js';
import { AuthFailure } from '../identity/index.js';
import { Secrets } from './secrets.js';
import { SecretCipher } from './secretCipher.js';
import { keyRoutes } from './keyRoutes.js';

it('maps a removal eligibility race to 403 but leaves operational errors as sanitized 500', async () => {
  let failure: Error = new AuthFailure('invalid_credentials');
  const app = await buildServer({
    broker: new Broker(),
    resolver: headerStub,
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  keyRoutes(
    new Secrets(new SecretCipher('test', new Map([['test', randomBytes(32)]])), () =>
      Promise.reject(failure),
    ),
    'https://example.test',
    () => Promise.reject(failure),
  )(app);
  const request = {
    method: 'DELETE' as const,
    url: '/api/keys/openai',
    headers: { origin: 'https://example.test', authorization: `stub ${randomUUID()}:user` },
  };
  try {
    const denied = await app.inject(request);
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toEqual({ error: 'account cannot use keys' });
    expect(denied.headers['cache-control']).toBe('no-store');
    failure = new Error('synthetic private storage detail');
    const failed = await app.inject(request);
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain(failure.message);
  } finally {
    await app.close();
  }
});
