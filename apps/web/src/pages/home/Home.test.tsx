import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentAccount, type AuthState } from '@/core/auth';
import { usePages } from './usePages';
import { Home } from './Home';

vi.mock('@/core/auth', () => ({ useCurrentAccount: vi.fn() }));
vi.mock('./usePages', () => ({ usePages: vi.fn() }));
const refresh = vi.fn();
const account = {
  id: 'alice',
  email: '',
  displayName: 'Alice',
  role: 'user' as const,
  createdAt: 0,
};
function render(auth: AuthState): string {
  vi.mocked(useCurrentAccount).mockReturnValue({ state: auth, refresh });
  return renderToStaticMarkup(<Home />);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePages).mockReturnValue({
    items: [],
    loading: false,
    error: null,
    unauthorized: false,
    paused: false,
    hasMore: false,
    refresh,
    loadMore: vi.fn(),
  });
});
describe('Home current account', () => {
  it('waits for the shared account without mounting project requests', () => {
    expect(render({ status: 'loading' })).toContain('Checking your account');
    expect(usePages).not.toHaveBeenCalled();
  });
  it('shows an account lookup error rather than treating a server failure as signed out', () => {
    const html = render({ status: 'error' });
    expect(html).toContain('Unable to check your account');
    expect(html).toContain('Try again');
    expect(html).not.toContain('Continue to Landing');
    expect(usePages).not.toHaveBeenCalled();
  });
  it.each(['identity', 'stub'] as const)('sends a signed-out %s visitor to Landing', (mode) => {
    const html = render({ status: 'signed-out', mode });
    expect(html).toContain('href="#/"');
    expect(html).toContain('Continue to Landing');
    expect(html).toContain(mode === 'stub' ? 'development account' : 'Sign in');
    expect(usePages).not.toHaveBeenCalled();
  });
  it.each(['identity', 'stub'] as const)('loads projects for the shared %s account', (mode) => {
    const html = render({ status: 'ready', mode, account });
    expect(html).toContain('Alice');
    expect(usePages).toHaveBeenCalledWith('/api/projects', expect.any(Function));
  });
  it('keeps the expired-cookie path after the account was initially ready', () => {
    vi.mocked(usePages).mockReturnValue({
      items: [],
      loading: false,
      error: 'Session expired',
      unauthorized: true,
      paused: true,
      hasMore: false,
      refresh,
      loadMore: vi.fn(),
    });
    const html = render({ status: 'ready', mode: 'identity', account });
    expect(html).toContain('Session expired');
    expect(html).toContain('Continue to sign in');
    expect(html).toContain('href="#/"');
  });
});
