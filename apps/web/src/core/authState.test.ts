import { describe, expect, it } from 'vitest';
import { authStateOf } from './authState';

const alice = {
  id: 'a-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
  createdAt: 1,
};

describe('web core: who is using this tab', () => {
  it('takes the account the server names, and ignores a development cookie beside it', () => {
    expect(authStateOf(200, alice, 'somebody-else')).toEqual({
      status: 'ready',
      mode: 'identity',
      account: alice,
    });
  });

  it('is signed out on 401, even when a development cookie is lying around', () => {
    // This is the case the Landing page got wrong in the other direction: real
    // sign-in is on, so the development cookie means nothing either way.
    expect(authStateOf(401, null, 'demo')).toEqual({ status: 'signed-out', mode: 'identity' });
  });

  it('falls back to the development account only when the server has no /api/me at all', () => {
    expect(authStateOf(404, null, 'demo')).toMatchObject({
      status: 'ready',
      mode: 'stub',
      account: { id: 'demo', role: 'user' },
    });
    expect(authStateOf(404, null, null)).toEqual({ status: 'signed-out', mode: 'stub' });
  });

  it('calls a 500, or a 200 that is not an account, an error and not "signed out"', () => {
    expect(authStateOf(500, null, 'demo')).toEqual({ status: 'error' });
    expect(authStateOf(200, { id: 'a-1' }, null)).toEqual({ status: 'error' });
    expect(authStateOf(200, { ...alice, role: 'root' }, null)).toEqual({ status: 'error' });
  });
});
