import { describe, expect, it } from 'vitest';
import { canReadStatus, headerStub, principalFromHeader } from './authGuard.js';

describe('core: temporary header account', () => {
  it('reads the account id and role from a well-formed header', () => {
    expect(principalFromHeader('stub acc-1:staff')).toEqual({ accountId: 'acc-1', role: 'staff' });
  });

  it('rejects a missing header and a role it does not know', () => {
    expect(principalFromHeader(undefined)).toBeNull();
    expect(principalFromHeader('stub acc-1:root')).toBeNull();
    expect(principalFromHeader('Bearer token')).toBeNull();
  });

  it('lets any status be read with the development stub', () => {
    expect(canReadStatus('stopped')).toBe(true);
  });
});

describe('core: the stub resolver', () => {
  it('reads the header when there is one', async () => {
    const principal = await headerStub.resolve({ authorization: 'stub acc-1:user', cookies: {} });
    expect(principal).toEqual({ accountId: 'acc-1', role: 'user' });
  });

  it('falls back to the stub cookie, which is how a browser socket signs in', async () => {
    const principal = await headerStub.resolve({ cookies: { lumen_stub: 'stub acc-2:staff' } });
    expect(principal).toEqual({ accountId: 'acc-2', role: 'staff' });
  });

  it('resolves nobody when neither is present', async () => {
    expect(await headerStub.resolve({ cookies: {} })).toBeNull();
  });
});
