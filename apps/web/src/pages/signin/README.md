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
- GitHub/Google controls are visibly unavailable until OAuth routes ship.
- The 15-code-point signup minimum mirrors AccountService's provisional policy;
  existing password login does not impose this new minimum.

The server plugin is not mounted by main.ts and no durable account adapter exists
yet. Missing endpoints produce an explicit unavailable message, not a fake login.
The shell and other pages still use their development auth behavior; do not call
this a production end-to-end authentication feature.

## Verification

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
