import { lazy, StrictMode, Suspense, useEffect, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { StaffGuard, useCurrentAccount } from './core/auth.js';
import { renderRoute, useHash, type Route } from './core/router.js';
import { AppShell } from './core/shell.js';
import { Landing } from './pages/landing/Landing.js';
import { SignIn } from './pages/signin/SignIn.js';
import { AccountActions } from './pages/signin/AccountActions.js';
import './styles/theme.css';

// The front page and sign-in are in the first download; every other page is
// its own, fetched when it is opened. All of them in one file made the first
// visit download and parse about 1 MB of script (Markdown, KaTeX, the
// session and admin pages) before the front page could draw.
const pages = {
  home: () => import('./pages/home/Home.js'),
  session: () => import('./pages/session/Session.js'),
  settings: () => import('./pages/settings/Settings.js'),
  account: () => import('./pages/signin/AccountSettings.js'),
  admin: () => import('./pages/admin/Admin.js'),
  agents: () => import('./pages/agents/Agents.js'),
};
const Home = lazy(() => pages.home().then((page) => ({ default: page.Home })));
const Session = lazy(() => pages.session().then((page) => ({ default: page.Session })));
const Settings = lazy(() => pages.settings().then((page) => ({ default: page.Settings })));
const AccountSettings = lazy(() =>
  pages.account().then((page) => ({ default: page.AccountSettings })),
);
const Agents = lazy(() => pages.agents().then((page) => ({ default: page.Agents })));
const Admin = lazy(() => pages.admin().then((page) => ({ default: page.Admin })));

/**
 * Once the first page has drawn and the browser is idle, the pages a person
 * goes to next are fetched ahead, so opening a project does not wait for its
 * script: the flight into the session's title waits for the page at most 600 ms.
 */
function fetchAhead(): void {
  const later = (): void => {
    void pages.home();
    void pages.session();
    void pages.settings();
    void pages.account();
    void pages.agents();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(later, { timeout: 4000 });
  else globalThis.setTimeout(later, 2000);
}

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
  { path: '/agents', render: () => <Agents /> },
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
      {/* Nothing while a page's script arrives: it is fetched ahead, so this is
          a moment on a first visit at most, and the scene is already there. */}
      <Suspense fallback={null}>
        {renderRoute(routes, path, () => (
          <UnknownRoute />
        ))}
      </Suspense>
    </AppShell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
fetchAhead();
