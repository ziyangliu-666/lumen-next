import { describe, expect, it } from 'vitest';
import { headerStub, requireStaff, requireUser } from './authGuard.js';
import { HttpError, notFound } from './httpError.js';
import { Router, type RawRequest } from './router.js';

// The router is deliberately not bound to a socket, so every route below is
// exercised without opening a port.

function raw(method: string, url: string, extra: Partial<RawRequest> = {}): RawRequest {
  return { method, url, headers: {}, body: '', ...extra };
}

describe('core: Router', () => {
  it('routes a path to its handler and returns the value as the body', async () => {
    const router = new Router(headerStub);
    router.get('/api/health', () => ({ status: 'ok' }));

    expect(await router.dispatch(raw('GET', '/api/health'))).toEqual({
      status: 200,
      body: { status: 'ok' },
    });
  });

  it('captures path parameters and query string', async () => {
    const router = new Router(headerStub);
    router.get('/api/tasks/:id', (request) => ({
      id: request.params['id'],
      q: request.query['q'],
    }));

    const reply = await router.dispatch(raw('GET', '/api/tasks/t-1?q=deep'));

    expect(reply.body).toEqual({ id: 't-1', q: 'deep' });
  });

  it('separates an unknown path from a known path with the wrong verb', async () => {
    const router = new Router(headerStub);
    router.get('/api/files', () => []);

    expect((await router.dispatch(raw('GET', '/api/nope'))).status).toBe(404);
    expect((await router.dispatch(raw('POST', '/api/files'))).status).toBe(405);
  });

  it('parses a JSON body and refuses one that is not JSON', async () => {
    const router = new Router(headerStub);
    router.post('/api/echo', (request) => request.body);

    expect((await router.dispatch(raw('POST', '/api/echo', { body: '{"a":1}' }))).body).toEqual({
      a: 1,
    });
    expect((await router.dispatch(raw('POST', '/api/echo', { body: '{oops' }))).status).toBe(400);
  });

  it('resolves the principal before the handler runs', async () => {
    const router = new Router(headerStub);
    router.get('/api/me', (request) => requireUser(request));

    const signedIn = await router.dispatch(
      raw('GET', '/api/me', { headers: { authorization: 'stub acc-1:user' } }),
    );
    expect(signedIn.body).toEqual({ accountId: 'acc-1', role: 'user' });

    const anonymous = await router.dispatch(raw('GET', '/api/me'));
    expect(anonymous.status).toBe(401);
  });

  it('turns a staff-only route into 403 for a plain user', async () => {
    const router = new Router(headerStub);
    router.get('/api/admin', (request) => requireStaff(request));

    const asUser = await router.dispatch(
      raw('GET', '/api/admin', { headers: { authorization: 'stub acc-1:user' } }),
    );
    expect(asUser.status).toBe(403);

    const asStaff = await router.dispatch(
      raw('GET', '/api/admin', { headers: { authorization: 'stub acc-2:staff' } }),
    );
    expect(asStaff.status).toBe(200);
  });

  it('carries an HttpError status through and answers 204 for nothing', async () => {
    const router = new Router(headerStub);
    router.get('/api/missing', () => {
      throw notFound('no such task');
    });
    router.delete('/api/thing', () => undefined);

    const missing = await router.dispatch(raw('GET', '/api/missing'));
    expect(missing).toEqual({ status: 404, body: { error: 'no such task' } });
    expect((await router.dispatch(raw('DELETE', '/api/thing'))).status).toBe(204);
  });

  it('lets an unexpected throw escape rather than dressing it as a 4xx', async () => {
    const router = new Router(headerStub);
    router.get('/api/bug', () => {
      throw new Error('a real bug');
    });

    await expect(router.dispatch(raw('GET', '/api/bug'))).rejects.toThrow('a real bug');
  });

  it('reads cookies into the request', async () => {
    const router = new Router(headerStub);
    router.get('/api/c', (request) => request.cookies);

    const reply = await router.dispatch(
      raw('GET', '/api/c', { headers: { cookie: 'sid=abc; theme=dark' } }),
    );
    expect(reply.body).toEqual({ sid: 'abc', theme: 'dark' });
  });

  it('reports whether a path is claimed at all', () => {
    const router = new Router(headerStub);
    router.get('/api/files', () => []);

    expect(router.handles('/api/files')).toBe(true);
    expect(router.handles('/api/other')).toBe(false);
  });

  it('exposes the status on the error it throws', () => {
    expect(new HttpError(418, 'teapot').status).toBe(418);
  });
});
