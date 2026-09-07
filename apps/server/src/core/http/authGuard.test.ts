import { describe, expect, it } from 'vitest';
import { canReadStatus, principalFromHeader } from './authGuard.js';

describe('core: temporary header account', () => {
  it('reads the account id and role from a well-formed header', () => {
    expect(principalFromHeader('stub acc-1:staff')).toEqual({ accountId: 'acc-1', role: 'staff' });
  });

  it('rejects a missing header and a role it does not know', () => {
    expect(principalFromHeader(undefined)).toBeNull();
    expect(principalFromHeader('stub acc-1:root')).toBeNull();
    expect(principalFromHeader('Bearer token')).toBeNull();
  });

  it('lets any status be read during sprint 1', () => {
    expect(canReadStatus('stopped')).toBe(true);
  });
});
