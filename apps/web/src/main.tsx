import { StrictMode, useEffect, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { StaffGuard, useCurrentAccount } from './core/auth.js';
import { renderRoute, useHash, type Route } from './core/router.js';
import { AppShell } from './core/shell.js';
import { Landing } from './pages/landing/Landing.js';
import { SignIn } from './pages/signin/SignIn.js';
import { AccountSettings } from './pages/signin/AccountSettings.js';
import { AccountActions } from './pages/signin/AccountActions.js';
import { Home } from './pages/home/Home.js';
import { Session } from './pages/session/Session.js';
import { Settings } from './pages/settings/Settings.js';
import { Admin } from './pages/admin/Admin.js';
import './styles/theme.css';

function settingsPage(tab: 'account' | 'wallet' | 'keys'): JSX.Element {
  return (
    <Settings
      accountContent={<AccountSettings />}
      tab={tab}
      onTabChange={(next) => {
        window.location.hash =
          next === 'account'
            ? '/settings/account'
            : next === 'keys'
              ? '/settings/keys'
              : '/settings';
      }}
    />
  );
}

const routes: readonly Route[] = [
  { path: '/', render: () => <Landing /> },
  { path: '/signin', render: () => <SignIn /> },
  { path: '/home', render: () => <Home /> },
  { path: '/session', render: () => <Session /> },
  { path: '/settings', render: () => settingsPage('wallet') },
  { path: '/settings/account', render: () => settingsPage('account') },
  { path: '/settings/keys', render: () => settingsPage('keys') },
  {
    path: '/admin',
    render: () => (
      <StaffGuard>
        <Admin />
      </StaffGuard>
    ),
  },
];

/**
 * An address no route knows, such as #/projects. Signed in, it goes to the
 * projects: before, it drew the signed-out front page under the account's
 * bar, which looked broken. Signed out, it is the front page.
 */
function UnknownRoute(): JSX.Element {
  const { state } = useCurrentAccount();
  const ready = state.status === 'ready';
  useEffect(() => {
    if (ready) window.location.replace('#/home');
  }, [ready]);
  return ready ? <></> : <Landing />;
}

function App(): JSX.Element {
  const path = useHash();
  return (
    <AppShell path={path} accountActions={<AccountActions />}>
      {renderRoute(routes, path, () => (
        <UnknownRoute />
      ))}
    </AppShell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
