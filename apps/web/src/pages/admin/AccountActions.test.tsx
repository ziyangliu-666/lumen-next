import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { useCurrentAccount } from '@/core/auth';
import { AccountActions } from './AccountActions';
vi.mock('@/core/auth', () => ({ useCurrentAccount: vi.fn() }));
const actor = {
  id: 'admin',
  role: 'staff' as const,
  email: 'admin@example.test',
  displayName: 'Admin',
  createdAt: 0,
};
it('blocks self changes and exposes role/suspension actions only for another account', () => {
  vi.mocked(useCurrentAccount).mockReturnValue({
    state: { status: 'ready', mode: 'identity', account: actor },
    refresh: vi.fn(),
  });
  const self = renderToStaticMarkup(
    <AccountActions account={{ ...actor, suspended: false }} onChanged={() => undefined} />,
  );
  expect(self).toContain('cannot change your own');
  expect(self).not.toContain('Suspend account');
  const other = renderToStaticMarkup(
    <AccountActions
      account={{ ...actor, id: 'other', role: 'user', suspended: true }}
      onChanged={() => undefined}
    />,
  );
  expect(other).toContain('Change role to staff');
  expect(other).toContain('Restore account');
  vi.mocked(useCurrentAccount).mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
  expect(
    renderToStaticMarkup(
      <AccountActions account={{ ...actor, suspended: false }} onChanged={() => undefined} />,
    ),
  ).toContain('Real staff sign-in');
});
