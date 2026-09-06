import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { useRoute, type Route } from './core/router.js';
import { Landing } from './pages/landing/Landing.js';
import { SignIn } from './pages/signin/SignIn.js';
import { Home } from './pages/home/Home.js';
import { Session } from './pages/session/Session.js';
import { Settings } from './pages/settings/Settings.js';
import { Admin } from './pages/admin/Admin.js';

const routes: readonly Route[] = [
  { path: '/', render: () => <Landing /> },
  { path: '/signin', render: () => <SignIn /> },
  { path: '/home', render: () => <Home /> },
  { path: '/session', render: () => <Session /> },
  { path: '/settings', render: () => <Settings /> },
  { path: '/admin', render: () => <Admin /> },
];

function App(): JSX.Element {
  return useRoute(routes, () => <Landing />);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
