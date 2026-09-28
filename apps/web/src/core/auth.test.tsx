import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCurrentAccount, StaffGate, type AuthState } from './auth';

const staff = {
  id: 'a-1',
  email: 'staff@example.test',
  displayName: 'Staff',
  role: 'staff' as const,
  createdAt: 1,
};

function answer(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
}

function gate(state: AuthState): string {
  return renderToStaticMarkup(
    <StaffGate state={state} refresh={() => undefined}>
      <p>Admin page</p>
    </StaffGate>,
  );
}

beforeEach(() => vi.stubGlobal('document', { cookie: '' }));
afterEach(() => vi.unstubAllGlobals());

describe('web core: asking the server who is signed in', () => {
  it('reads /api/me through request() and takes the account it names', async () => {
    answer(200, staff);
    expect(await readCurrentAccount()).toEqual({
      status: 'ready',
      mode: 'identity',
      account: staff,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('reads a 404 as a process with no identity, not as an error', async () => {
    // Without a database, /api/me is not registered and Fastify answers 404.
    answer(404, { error: 'Not Found' });
    expect(await readCurrentAccount()).toEqual({ status: 'signed-out', mode: 'stub' });
    vi.stubGlobal('document', { cookie: 'lumen_stub=stub demo:user' });
    expect(await readCurrentAccount()).toMatchObject({
      status: 'ready',
      mode: 'stub',
      account: { id: 'demo' },
    });
  });

  it('is signed out on 401, and an error on 500 or when the network fails', async () => {
    answer(401, { error: 'unauthenticated' });
    expect(await readCurrentAccount()).toEqual({ status: 'signed-out', mode: 'identity' });
    answer(500, { error: 'boom' });
    expect(await readCurrentAccount()).toEqual({ status: 'error' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('network down'))),
    );
    expect(await readCurrentAccount()).toEqual({ status: 'error' });
  });
});

describe('web core: the staff guard', () => {
  it('renders the page for real staff', () => {
    expect(gate({ status: 'ready', mode: 'identity', account: staff })).toContain('Admin page');
  });

  it('holds the page back from a real non-staff account and a signed-out visitor', () => {
    for (const state of [
      { status: 'ready', mode: 'identity', account: { ...staff, role: 'user' } },
      { status: 'signed-out', mode: 'identity' },
    ] as const) {
      const html = gate(state);
      expect(html).not.toContain('Admin page');
      expect(html).toContain('Redirecting');
    }
  });

  it('does not block when the process has no identity (the 404 case)', () => {
    const stubUser = { ...staff, role: 'user' as const };
    expect(gate({ status: 'ready', mode: 'stub', account: stubUser })).toContain('Admin page');
    expect(gate({ status: 'signed-out', mode: 'stub' })).toContain('Admin page');
  });

  it('offers a retry, not the page, when the server cannot answer', () => {
    const html = gate({ status: 'error' });
    expect(html).toContain('Unable to check access');
    expect(html).not.toContain('Admin page');
  });
});
