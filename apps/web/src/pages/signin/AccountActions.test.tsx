import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentAccount, type AuthState } from '@/core/auth';
import { AccountActions } from './AccountActions';

vi.mock('@/core/auth', () => ({ useCurrentAccount: vi.fn() }));
const refresh = vi.fn();
const account = {
  id: 'alice',
  email: 'alice@example.test',
  displayName: 'Alice',
  role: 'user' as const,
  createdAt: 0,
};
function render(state: AuthState): string {
  vi.mocked(useCurrentAccount).mockReturnValue({ state, refresh });
  return renderToStaticMarkup(<AccountActions />);
}
beforeEach(() => vi.clearAllMocks());
describe('Shared header identity actions', () => {
  it('does not offer signout until the account is known', () => {
    const html = render({ status: 'loading' });
    expect(html).toContain('Checking account');
    expect(html).not.toContain('Sign out');
  });
  it('offers retry without treating a lookup failure as a successful signout', () => {
    const html = render({ status: 'error' });
    expect(html).toContain('Retry account check');
    expect(html).not.toContain('Sign out');
  });
  it.each(['identity', 'stub'] as const)('offers sign-in to a signed-out %s visitor', (mode) => {
    const html = render({ status: 'signed-out', mode });
    expect(html).toContain('href="#/signin"');
    expect(html).not.toContain('Sign out');
  });
  it.each(['user', 'staff'] as const)(
    'offers account settings and signout for a real %s',
    (role) => {
      const html = render({ status: 'ready', mode: 'identity', account: { ...account, role } });
      expect(html).toContain('href="#/settings/account"');
      expect(html).toContain('Sign out');
      expect(html).not.toContain(account.email);
    },
  );
  it('never sends real session signout for a development stub', () => {
    const html = render({ status: 'ready', mode: 'stub', account });
    expect(html).toContain('Development account');
    expect(html).not.toContain('Sign out');
  });
});
