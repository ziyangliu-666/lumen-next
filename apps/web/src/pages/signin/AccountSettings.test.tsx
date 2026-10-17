import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentAccount, type AuthState } from '@/core/auth';
import { AccountPanel } from './AccountPanel';
import { AccountSettings } from './AccountSettings';

vi.mock('@/core/auth', () => ({ useCurrentAccount: vi.fn() }));
vi.mock('./AccountPanel', () => ({ AccountPanel: vi.fn(() => <p>Account editor</p>) }));
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
  return renderToStaticMarkup(<AccountSettings />);
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
describe('Account settings access', () => {
  it('waits for the shared account before mounting the editor', () => {
    const html = render({ status: 'loading' });
    expect(html).toContain('Checking your account');
    expect(html).not.toContain('Account editor');
  });
  it('offers retry rather than presenting a server error as signout', () => {
    const html = render({ status: 'error' });
    expect(html).toContain('Try again');
    expect(html).not.toContain('Account editor');
    expect(html).not.toContain('href="#/signin"');
  });
  it('offers sign-in when the real session is missing', () => {
    const html = render({ status: 'signed-out', mode: 'identity' });
    expect(html).toContain('href="#/signin"');
    expect(html).not.toContain('Account editor');
  });
  it.each(['ready', 'signed-out'] as const)(
    'does not offer password controls in %s stub mode',
    (status) => {
      const html = render(
        status === 'ready' ? { status, mode: 'stub', account } : { status, mode: 'stub' },
      );
      expect(html).toContain('This server has no account database');
      expect(html).not.toContain('Account editor');
    },
  );
  it.each(['user', 'staff'] as const)('mounts the editor for a real %s', (role) => {
    expect(render({ status: 'ready', mode: 'identity', account: { ...account, role } })).toContain(
      'Account editor',
    );
  });
  it('sends the user to sign-in after signing out or deleting the account', () => {
    const location = { hash: '#/settings/account' };
    vi.stubGlobal('window', { location });
    const onSignedOut = vi.fn();
    vi.mocked(useCurrentAccount).mockReturnValue({
      state: { status: 'ready', mode: 'identity', account },
      refresh,
    });
    renderToStaticMarkup(<AccountSettings onSignedOut={onSignedOut} />);
    const props = vi.mocked(AccountPanel).mock.calls[0]?.[0];
    props?.onSignedOut();
    expect(location.hash).toBe('/signin');
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
});
