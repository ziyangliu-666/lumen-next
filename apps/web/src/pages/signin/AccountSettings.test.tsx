import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentAccount, type AuthState } from '@/core/auth';
import { AccountSettings } from './AccountSettings';

vi.mock('@/core/auth', () => ({ useCurrentAccount: vi.fn() }));
vi.mock('./AccountPanel', () => ({ AccountPanel: () => <p>Account editor</p> }));
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
      expect(html).toContain('requires database-backed authentication');
      expect(html).not.toContain('Account editor');
    },
  );
  it.each(['user', 'staff'] as const)('mounts the editor for a real %s', (role) => {
    expect(render({ status: 'ready', mode: 'identity', account: { ...account, role } })).toContain(
      'Account editor',
    );
  });
});
