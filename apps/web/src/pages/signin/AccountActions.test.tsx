import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentAccount, type AuthState } from '@/core/auth';
import { accountEntries, AccountActions } from './AccountActions';

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
  // The menu's items render in a portal only once it is open, so the entries
  // are read from the function the menu draws them from.
  it.each(['user', 'staff'] as const)(
    'offers account settings and signout for a real %s',
    (role) => {
      const state = { status: 'ready', mode: 'identity', account: { ...account, role } } as const;
      const html = render(state);
      expect(html).toContain('Account menu: Alice');
      expect(html).not.toContain(account.email);
      const entries = accountEntries(state);
      expect(entries).toContainEqual({ kind: 'link', label: 'Settings', href: '#/settings' });
      expect(entries).toContainEqual({ kind: 'signout', label: 'Sign out', session: true });
      expect(entries.some((entry) => entry.kind === 'link' && entry.href === '#/admin')).toBe(
        role === 'staff',
      );
    },
  );
  it('never sends real session signout for a development stub', () => {
    const state = { status: 'ready', mode: 'stub', account } as const;
    expect(render(state)).toContain('Account menu: Alice');
    const signout = accountEntries(state).find((entry) => entry.kind === 'signout');
    expect(signout).toEqual({ kind: 'signout', label: 'Sign out', session: false });
  });
});
