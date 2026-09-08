# identity — API design (draft)

Owner: LU YI. Status: **draft, not committed, no PR.** Grounded in
`docs/ARCHITECTURE.md` §7 and §6 (commit `2c2c691`) plus the actual code on
the accepted `core/http-fastify` branch (PR #5, open, unmerged as of
2026-09-07) — not the rejected `core/http-transport` branch (PR #3, closed).
See the "Problems found" section at the bottom for what this changes versus
the architecture doc, and "Open questions" for what still needs a decision.

---

## 0. The two interfaces this slice has to design

This monolith has **no REST API between slices** — `main.ts` says so
explicitly ("no public API between the slices — they call each other
in-process through their public indexes"). So "design an interface to
interact with others" means two different things here, and they need two
different documents:

| | Who calls it | Shape |
|---|---|---|
| **A. Browser-facing HTTP API** | the `signin` and `settings→Account` pages, via `fetch`/TanStack Query | REST over HTTPS, JSON, cookie session |
| **B. Module interface** (`modules/identity/index.ts`) | `core` (the auth hook) and `billing` (admin) in-process | plain TypeScript functions, no network, no auth check (already done) |

Concretely, the interfaces you own and must design:

1. **`principalResolver: PrincipalResolver`** — implements `core/http`'s
   `resolve(raw): Promise<Principal | null>`. `main.ts`/`server.ts` swaps this
   in for `headerStub` at startup. This is the single point where identity
   plugs into every other slice's auth guard — get this one right first.
2. **`registerRoutes(app: FastifyInstance)`** — identity's own browser-facing
   routes (Part A below).
3. **`listAccounts()`, `getAccount(id)`, `setRole(id, role)`, `suspend(id, on)`**
   — called by billing's admin routes (`GET /api/admin/accounts`,
   `PATCH /api/admin/accounts/:id`). You own the `AccountSummary` type these
   return; it isn't in `packages/contracts` (frozen, and scoped to
   session/task data only), so it's yours to define in your own `index.ts`.
4. **`sendMail(to, template)`** — no other slice calls this per
   `docs/ARCHITECTURE.md` §2's dependency diagram today, so treat it as
   identity-internal (verification, password reset) until someone asks for it.
   See open question #3.

Nothing in §2's dependency diagram has identity calling *out* to another
slice — only `core`. You are a provider here, not a consumer.

---

## Part A — Browser-facing HTTP API

### Overview

Sign-up, sign-in (password + GitHub/Google OAuth), sign-out, and account
self-service (view/edit/delete, change password) for UC1. Backs the `signin`
page and the Account tab of `settings`.

### Environment

| Env | Base URL | Notes |
|---|---|---|
| Dev | `http://localhost:4173/api` | `apps/web` dev server proxies to the server port; server port is `LUMEN_PORT` from `.env` (`.env.example` doesn't set one for the API — **open question #1**) |
| Staging | *(not yet provisioned — `deploy.yml`'s `staging` job is a placeholder)* | |
| Production | *(not yet provisioned — manual-approval gate in `deploy.yml`)* | |

One origin serves `/api`, `/ws`, and the built SPA (`server.ts` on the
accepted branch) — no CORS configuration needed.

### Authentication

- **Session cookie**, `Set-Cookie` from `@fastify/cookie`, `httpOnly`,
  `sameSite=Lax` by default (per `core/http-fastify`'s `Reply`/`SetCookie`
  shape). Set by `POST /api/auth/password`, `POST /api/auth/signup`, and the
  OAuth callbacks; cleared by `POST /api/auth/signout`.
- **Dev-only stub**: `Authorization: stub <accountId>:<role>` header, handled
  by `core`'s `headerStub` — only relevant until `principalResolver` (item 1
  above) replaces it. Don't design against this; it's scaffolding.
- Every route is resolved to a `Principal | null` by `core`'s `onRequest`
  hook before any handler runs (`request.principal`). A handler that needs a
  signed-in user calls `requireUser(request)`; staff-only calls
  `requireStaff(request)`. Both throw `HttpError` (401/403) if not satisfied
  — a handler never checks `principal` itself.

### Endpoints

| Method | Path | Auth | Does |
|---|---|---|---|
| `POST` | `/api/auth/signup` | none | Create an account by email + password |
| `POST` | `/api/auth/password` | none | Sign in with email + password |
| `GET` | `/api/auth/github` | none | Redirect to GitHub's OAuth consent screen |
| `GET` | `/api/auth/github/callback` | none | Exchange the OAuth code, create session |
| `GET` | `/api/auth/google` | none | Redirect to Google's OAuth consent screen |
| `GET` | `/api/auth/google/callback` | none | Exchange the OAuth code, create session |
| `POST` | `/api/auth/signout` | user | Clear the current session |
| `POST` | `/api/auth/signout-all` | user | Clear every session for this account |
| `GET` | `/api/me` | user | Current account (id, email, role) |
| `PATCH` | `/api/me` | user | Update email / display fields |
| `POST` | `/api/me/password` | user | Change password (requires current password) |
| `DELETE` | `/api/me` | user | Delete own account |

### Request

| Endpoint | Body / params | Type | Required |
|---|---|---|---|
| `POST /api/auth/signup` | `email` | string, valid email | yes |
| | `password` | string, ≥ 8 chars — **open question #2: exact policy** | yes |
| `POST /api/auth/password` | `email` | string | yes |
| | `password` | string | yes |
| `GET /api/auth/*/callback` | `code`, `state` | query string, from the provider redirect | yes |
| `PATCH /api/me` | `email` | string, valid email | no |
| `POST /api/me/password` | `currentPassword` | string | yes |
| | `newPassword` | string | yes |
| `DELETE /api/me` | `password` | string — confirm before destructive delete | yes (password-account only) |

### Response

| Endpoint | Status | Body |
|---|---|---|
| `POST /api/auth/signup`, `/password` | 200 | `{ accountId: string; role: 'user' \| 'staff' }` + `Set-Cookie` |
| `GET /api/auth/*/callback` | 302 | redirect to `/` (or `/admin` for staff — see Business Rules), + `Set-Cookie` |
| `POST /api/auth/signout`, `signout-all` | 204 | empty, clears cookie |
| `GET /api/me` | 200 | `{ id, email, role, createdAt }` |
| `PATCH /api/me` | 200 | the updated account, same shape as `GET /api/me` |
| `POST /api/me/password` | 204 | empty |
| `DELETE /api/me` | 204 | empty, clears cookie |

### Error handling

Every non-2xx body is `{ error: string }` — one human-readable message, no
separate machine-readable code today (`core/http/httpError.ts`, both
branches). Status codes come from `HttpError`'s factories:

| Status | Factory | When |
|---|---|---|
| 400 | `badRequest(message)` | malformed body, weak password, mismatched confirmation |
| 401 | `unauthorized(message)` | `requireUser` on a route with no session; wrong password on sign-in |
| 403 | `forbidden(message)` | `requireStaff` on a route from a non-staff account |
| 404 | `notFound(message)` | OAuth callback for an unknown/expired `state` |
| 500 | *(uncaught)* | a bug — logged server-side, body never leaks detail |

**Open question #4**: 400/401 both cover "signup with a taken email" and
"wrong password" today with only a free-text message — the frontend can't
branch on a stable code (e.g. to show "email taken, try signing in instead"
vs a generic error). Worth raising with the PM whether `HttpError` should
carry an optional `code` field, since that's core, not yours to change alone.

### Examples

**Sign up — success**
```
POST /api/auth/signup
{ "email": "a.li@example.edu", "password": "correct horse battery" }

200 OK
Set-Cookie: lumen_session=…; HttpOnly; SameSite=Lax
{ "accountId": "acc-1", "role": "user" }
```

**Sign in — wrong password**
```
POST /api/auth/password
{ "email": "a.li@example.edu", "password": "wrong" }

401 Unauthorized
{ "error": "incorrect email or password" }
```

**Update account — not signed in**
```
PATCH /api/me
{ "email": "new@example.edu" }
(no cookie)

401 Unauthorized
{ "error": "sign in first" }
```

### Business rules

- Four ways in (GitHub OAuth, Google OAuth, password, existing session), one
  principal out — the design problem this slice's pattern exists for
  (`README.md`).
- Staff is not a separate hidden login: a staff account signs in on the same
  page/endpoints as everyone else and is routed to `/admin` by `role`
  (`docs/SLICES.md`, UC1 review note). Applies to every sign-in path,
  including both OAuth callbacks.
- A fifth way in must not change the sign-in flow's shape — the reason the
  candidate pattern is Strategy + Template Method rather than a growing
  if/else.
- OAuth state/PKCE is `arctic`'s job, not this slice's — the Strategy sits
  above `arctic`, not instead of it (`docs/CODING_STANDARDS.md`, Dependencies).

### Deployment / ownership

- Repo: `ziyangliu-666/lumen-next`, `apps/server/src/modules/identity/` +
  `apps/web/src/pages/signin/` + the Account tab under
  `apps/web/src/pages/settings/`.
- Deploy: one container (`Dockerfile`, repo root) built and pushed by
  `.github/workflows/deploy.yml`; staging → DAST (OWASP ZAP) → manual-approval
  production gate. No separate deploy for this slice — it's one process.
- Owner: LU YI (`youayouly`) — see `CODEOWNERS`.
- Logs: `app.log` via Fastify's built-in logger (`server.ts`,
  `LUMEN_LOG_LEVEL` env var, default `info`); no shipped log aggregator yet.

---

## Part B — Module interface (`modules/identity/index.ts`)

### Overview

What `core` and `billing` call in-process. No network hop, no auth check (the
caller is already inside the trusted process and, for HTTP-triggered calls,
already passed `requireStaff`/`requireUser` before reaching here).

### Where it's imported from

```ts
import { principalResolver, listAccounts, getAccount, setRole, suspend } from '../identity/index.js';
```
Only `modules/identity` (the barrel), never a file inside it — ESLint blocks
the rest (`docs/CODING_STANDARDS.md`, slice boundary).

### Trust boundary

None enforced here — by the time billing's admin route handler calls
`setRole`, `requireStaff(request)` has already run. These functions trust
their caller. **They must not be exported to the browser directly** (no route
in Part A calls `setRole` on a non-staff's behalf).

### Functions

```ts
export const principalResolver: PrincipalResolver; // resolve(raw) => Promise<Principal | null>

export function registerRoutes(app: FastifyInstance): void | Promise<void>;

export function listAccounts(): Promise<AccountSummary[]>;
export function getAccount(id: string): Promise<AccountSummary | null>;
export function setRole(id: string, role: 'user' | 'staff'): Promise<void>;
export function suspend(id: string, on: boolean): Promise<void>;

export function sendMail(to: string, template: MailTemplate): Promise<void>;
```

**Proposed types** (not in `packages/contracts` — these are yours to own and
export; not yet written in code anywhere):

```ts
export interface AccountSummary {
  readonly id: string;
  readonly email: string;
  readonly role: 'user' | 'staff';
  readonly suspended: boolean;
  readonly createdAt: number;
}

export type MailTemplate =
  | { readonly kind: 'verify-email'; readonly code: string }
  | { readonly kind: 'password-reset'; readonly code: string }
  | { readonly kind: 'welcome' };
```

### Parameters / return values

| Function | Param | Returns | Notes |
|---|---|---|---|
| `principalResolver.resolve` | `raw: string \| undefined` (the `Authorization` header) | `Principal \| null` | `null` ⇒ anonymous, not an error |
| `listAccounts` | — | `AccountSummary[]` | for `GET /api/admin/accounts` (billing) |
| `getAccount` | `id: string` | `AccountSummary \| null` | for `GET /api/admin/accounts/:id` (billing) |
| `setRole` | `id: string`, `role: 'user' \| 'staff'` | `void` | for `PATCH /api/admin/accounts/:id` (billing) |
| `suspend` | `id: string`, `on: boolean` | `void` | for `POST /api/admin/accounts/:id/kill` (billing) |

### Error handling

Plain thrown errors, not `HttpError` — these aren't HTTP handlers. Convention
to decide (**open question #5**): throw a domain error class
(`AccountNotFoundError`) that billing's route handler catches and re-throws
as `notFound()`, or return `null`/`void` and let the caller decide? `getAccount`
already models "not found" as `null` above — recommend the same for
`setRole`/`suspend` (throw only on a truly unexpected state, e.g. a role that
isn't `'user' | 'staff'`, which TypeScript already prevents at the boundary).

### Examples

```ts
// core/http/server.ts, at startup
const app = await buildServer({ broker, resolver: principalResolver, ... });

// billing's admin route handler
app.patch('/api/admin/accounts/:id', async (request) => {
  requireStaff(request);
  const { role } = request.body as { role: 'user' | 'staff' };
  await setRole(request.params.id, role);
  return { ok: true };
});
```

### Business rules

- `setRole`/`suspend`/`listAccounts`/`getAccount` exist so **billing owns the
  admin page's routes** while **identity owns the account data** — per
  `docs/ARCHITECTURE.md` §2: "a slice owns its tables; others read them
  through its public index." Billing must not query the `accounts` table
  directly.
- `principalResolver` must resolve in constant time relative to input size and
  must not throw on a malformed/garbage header — return `null`, since it runs
  on every single request via `onRequest`.

### Ownership

Same as Part A: LU YI, `apps/server/src/modules/identity/`.

---

## Problems found (vs. `docs/ARCHITECTURE.md` §7's identity section)

1. No Environment section at all — dev/staging/prod base URLs were undefined.
2. No statement of *how* the credential is transported (cookie vs. header) —
   added, grounded in `core/http-fastify`'s actual `@fastify/cookie` usage.
3. No error-code catalog — added, grounded in the real `httpError.ts`
   (identical on both core branches), not invented.
4. `AccountSummary` and `MailTemplate` were used in §7's function signatures
   but never defined anywhere in the repo or the doc — proposed shapes above,
   marked clearly as proposals.
5. §7 cites `Router` or an implicit Fastify `app` with no note that this type
   doesn't exist on `main` yet (`core/http-fastify` is still an open,
   unmerged PR) — flagged in the header of this doc and in memory, so this
   doesn't get treated as settled until it lands.
6. No request/response field-level detail, no examples, no explicit business
   rule for the staff-routing behaviour that's only mentioned in passing in
   `docs/SLICES.md` — all added above.

## Open questions (need an answer before this stops being a draft)

1. What port/base URL does the API actually serve on in dev — is it the same
   `LUMEN_PORT` the server binds, fronted by the Vite dev server as a proxy,
   or does the browser hit it directly? `.env.example` sets `LUMEN_PORT` but
   nothing wires a Vite proxy yet.
2. Password policy (min length, character classes) — not specified anywhere.
3. Does any other slice actually want `sendMail` later (e.g. billing, for a
   "cap exceeded" notice)? If yes, its `MailTemplate` union needs to be
   extensible without every caller importing identity's whole surface.
4. Should `HttpError` carry a stable machine-readable `code` alongside its
   message? This is a `core` change, needs the PM.
5. Error convention for the module-interface functions (Part B) — see above.
