# Sign in and sign up

Owner: LU YI. The existing shell route is `#/signin`; signup is a mode toggle on
that page. No new shell route or shared UI dependency was added.

- `SignIn.tsx` uses the shared PageHeader, Card, Input, Label and Button controls.
- `authClient.ts` sends same-origin JSON to `/api/auth/password` or
  `/api/auth/signup`. It validates the principal response and never stores a token.
- Pending requests disable fields/submission; a synchronous guard also prevents
  duplicate submits. Accessible alerts report mismatch, server and network errors.
- Passwords are cleared after a network attempt and when switching modes.
- User/staff go to `#/home` / `#/admin`. Existing query context is preserved;
  arbitrary redirect URLs are not accepted. Other pages still need to consume
  draft research context; this page does not start a project automatically.
- GitHub/Google controls read /api/auth/providers and activate only configured
  providers. Callback errors are restricted to known safe messages; see
  docs/luyi/OAUTH_SETUP.md for dependency/configuration and acceptance limitations.
- AccountPanel.tsx is reachable through "Manage signed-in account" on this page.
  It supports profile/password changes, signout-one/all and password-proven
  deletion of accounts without retained resources. The shell owner still needs
  to integrate it into the canonical Settings composition without cross-page imports.
- The 15-code-point signup minimum mirrors AccountService's provisional policy;
  existing password login does not impose this new minimum.

The server plugin is not mounted by main.ts. PostgreSQL stores and the separate
local PGlite entry point are implemented. Missing endpoints produce an explicit
unavailable message, not a fake login.
The shell and other pages still use their development auth behavior; do not call
this a production end-to-end authentication feature.

RecoveryPanel.tsx is reachable through "Forgot password / email verification".
It requests reset/verification codes and submits pasted codes; codes/passwords
are never put in URLs or browser storage. Local mail is a disk outbox by default,
not external delivery. See docs/luyi/MAIL_SETUP.md.

## Current real-backend checks

Against the local PGlite server, browser checks confirmed profile name changes,
password changes with field clearing, and deletion of a disposable password
account followed by /api/me returning 401. A real local outbox code also verified
an email, and a reset code changed the password and invalidated the old session.
Unconfigured OAuth buttons remain
unavailable; real GitHub/Google acceptance requires provider credentials. The
external-exchange tests are simulated, not live provider login.

## Earlier mock verification

The monorepo verify command typechecks/lints this page but its current Vitest
include pattern does not run web tests. Browser checks were therefore performed
separately through Playwright against a local Vite server with intercepted API
responses. They covered pending state, incorrect credentials, cleared secrets,
confirmation mismatch without a network request, successful signup/user redirect,
staff redirect, preserved query context and missing-backend feedback.

Desktop (1280px) and mobile (390px) screenshots were inspected; the signup page
had no horizontal overflow at 390px. Mocked responses do not prove durable backend
integration, real cookies or OAuth. Re-run against the real mounted plugin and
Postgres once core integration lands.
