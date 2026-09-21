import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { StaffGuard } from './core/auth.js';
import { renderRoute, useHash, type Route } from './core/router.js';
import { AppShell } from './core/shell.js';
import { Landing } from './pages/landing/Landing.js';
import { SignIn } from './pages/signin/SignIn.js';
import { Home } from './pages/home/Home.js';
import { Session } from './pages/session/Session.js';
import { Settings } from './pages/settings/Settings.js';
import { Admin } from './pages/admin/Admin.js';
import './styles/theme.css';

const routes: readonly Route[] = [
  { path: '/', render: () => <Landing /> },
  { path: '/signin', render: () => <SignIn /> },
  { path: '/home', render: () => <Home /> },
  { path: '/session', render: () => <Session /> },
  { path: '/settings', render: () => <Settings /> },
  {
    path: '/admin',
    render: () => (
      <StaffGuard>
        <Admin />
      </StaffGuard>
    ),
  },
];

function App(): JSX.Element {
  const path = useHash();
  return (
    <AppShell path={path}>
      {renderRoute(routes, path, () => (
        <Landing />
      ))}
    </AppShell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
