# LU YI working context

## Purpose and refresh rule

Persistent project context requested by LU YI. Read this before proposing identity work, together with `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/SLICES.md`, `CODEOWNERS`, the identity README, and the actual `packages/contracts/src/` files. Refresh remote refs before relying on the implementation status below. This note is not a replacement for the shared contract or owner review.

## Repository checkpoint

- Team remote: `origin`, https://github.com/ziyangliu-666/lumen-next.git.
- Personal remote: `mine`, https://github.com/youayouly/lumen-next.git.
- Sync branch: `identity/design-doc`; implementation now continues on `identity/auth-flow`.
- Implementation plan and steering handoff: `docs/luyi/IMPLEMENTATION.md`.
- Fetched both remotes and merged `origin/main` at `40bcdab` into the working branch without conflicts; merge commit `2313faf`.
- Team additions: HTTP and event stream (#5), session walking skeleton (#7).
- Validation: the first verify attempt failed with unresolved dependency types; after `npm ci`, `npm run verify` passed (63 tests, 96.57% line coverage).
- Personal remote design branch was `64c7561`; personal remote main was `2c2c691`. No push was performed during this sync.

## Publication checkpoint

The implementation has been committed and pushed to the personal repository:
https://github.com/youayouly/lumen-next/tree/identity/auth-flow.

Implementation commits: `65078df` (authentication/session foundations), `1f4cc68`
(account HTTP routes), `41c2dfb` (sign-in/signup UI), and `efe678e` (plans/context).
Earlier references to uncommitted work describe the pre-publication checkpoints.
Only `mine/identity/auth-flow` was pushed; no team-remote push, PR, merge or
production deployment was performed. The durable adapter/main wiring limitations
still apply. Pre-push verification: 201 passing tests and a successful web build.

## Reference links and access evidence

1. https://github.com/ziyangliu-666/lumen-next/blob/main/docs/ARCHITECTURE.md
   - Shared architecture, data structures, messages, public indexes and dependencies. The user explicitly requests this as context for future agent proposals.
   - Browser returned 404 in its current session. The same file was successfully obtained through authenticated Git fetch and read locally. Do not infer that the repository is missing.
2. https://docs.google.com/document/d/1b0HgFiO10m-j2bL4kQZMm-SeYtQtf5-dredMYH8YpT0/edit?tab=t.0
   - User-supplied team reference. Browser redirected to Google sign-in; document title and contents remain unread and unverified.
   - Ask for manual browser login or an exported document. Do not treat this note as evidence that its contents were read.
3. https://ziy.bio/lumen-next/
   - Successfully read the page specification, ownership map, module responsibilities and six page sections.
   - Local source reference: `docs/spec/index.html`. Treat the site as UI/product design, not proof of backend implementation.

## Team responsibilities

| Owner | Slice | Pages and responsibilities | Pattern |
|---|---|---|---|
| LU YI | identity | Sign in/up; Settings Account; password, GitHub, Google and existing login-session authentication; account data and email | Strategy + Template Method chosen in the design |
| PENG XUJIAN | projects | Landing and Home; project creation/cards/status; findings | State candidate |
| LIU ZIYANG | session plus shared core/contracts | Session call tree and steps; kernel, trace, delegation; shared HTTP, broker, schema and web shell | Composite |
| LI ZHUOYANG | steering | Session composer and files; queued steering, worker, compute and project storage | Command, compared with Strategy / Null Object |
| HE RONG | billing | Settings Wallet/Keys and Admin; ledger, budget checks/approval, Stripe, secrets and administration | Chain of Responsibility candidate |

These are responsibilities, not claims of completion. Main has the session walking skeleton, with in-memory trace and echo worker. The fetched `origin/steering/sandbox-foundations` branch contains steering design, routes, sandbox filesystem and command files/tests; it was not merged here and its tests were not assessed. Main's other slice README descriptions remain scaffolding-oriented.

## Identity integration boundaries

- Identity owns `apps/server/src/modules/identity/` and `apps/web/src/pages/signin/`.
- Settings Account belongs to identity in the slice/spec, but the entire settings directory belongs to billing in `CODEOWNERS`. Coordinate the Account component boundary before editing it.
- A slice may import core; core imports no slice. Other slices use identity's public index, never its internal files.
- Main already has `PrincipalResolver.resolve(from: Credentials)`, where credentials include authorization and cookies. Inject identity's resolver through the existing server dependency; do not introduce the older proposed `registerSessionVerifier` global port.
- HTTP and WebSocket authentication must agree. Stub authentication is development scaffolding, not real authentication.
- Billing needs the agreed account public index: `listAccounts`, `getAccount`, `setRole`, `suspend`; coordinate types and error semantics with billing.
- Staff use the same sign-in page; role-based routing does not replace server-side authorization.
- Coordinate shared core, main wiring, contract and UI changes with their owners.

## What is implemented versus designed

- `docs/ARCHITECTURE.md` describes the broader intended contract. Actual TypeScript in `packages/contracts/src/` is currently smaller; read both before writing a plan.
- Actual `ServerEvent`: `task.opened`, `task.status`, `task.cost`, `step.appended`, `finding.recorded`.
- Actual `ClientCommand`: `session.say`, `session.stop`, `task.steer`.
- Actual `Session`: id, projectId, accountId, startedAt. Actual `Step`: taskId, index, text. `SessionSnapshot` contains session, tasks and steps.
- Architecture's richer steps, snapshots/events and commands must not be assumed to exist in code yet. Shared contract changes require review.
- Money is USD; durable sums happen in SQL; browser display uses four decimals and does not sum.
- Main's HTTP errors currently serialize as `{ error: string }`.
- Fetched branch `origin/core/error-code-and-resolver-port` documents a decision for `{ error: { code, message, field? } }`; this is not implemented on main. Its cookie-resolver and session-access discussion is partly superseded by current main.

## Identity design reconciliation needed

- `docs/luyi/README.md` identifies `design.md` as the submission source; `API.md` is an earlier superseded sketch, not an equally authoritative contract.
- Submission routes (`/api/auth/login`, `/api/account`, etc.) differ from the shared architecture (`/api/auth/password`, `/api/me`, signout/signout-all, etc.). Resolve before implementation.
- Submission wiring and claims that HTTP/core integration is unavailable are stale after this merge.
- Identity now has the authentication template, password strategy/scrypt, login-session service/store port, SessionStrategy, cookie-only resolver, SessionAuthFlow, LoginGate, AccountService/AccountStore and routes for signup/password/signout/signout-all/me/profile/password-change. The #/signin page supports login/signup with real endpoint paths; browser checks used mock responses. Full verify passes with 201 tests and 97.79% line coverage (138 identity tests); web build passes. Concrete persistence, account deletion, Settings Account UI, OAuth/email and production wiring are not implemented. The development auth stub in main.ts is unchanged; this is not a runnable production sign-in feature yet.
- Full remaining-work plan: `docs/luyi/PLAN.md`. New-password minimum is provisionally 15 Unicode code points (1024 UTF-8 byte ceiling), pending team approval. Email changes require current-password proof and adapter-side hash comparison; existing sessions survive password changes per the submission. Signup and account-store writes are port-tested, not SQL-tested.
- Latest HTTP plan: `docs/luyi/HTTP_PLAN.md`. The plugin requires an exact configured Origin on mutations and secure cookies by default. Its local limiter keys on direct socket peers because core's unconditional trustProxy setting is not safe for trusting arbitrary forwarded addresses.
- Session plan and rough estimate: `docs/luyi/SESSION_PLAN.md` (7.5 human engineering hours including 25% allowance, excluding database/HTTP/UI). Lifetime is explicitly supplied by the caller; no default duration or renewal policy has been agreed.
- Site expects signup/signin to preserve the user's initial question/mode, supports GitHub/Google/password, and lists name, email, password and connected providers on Account.
- Site assigns email verification, templates/sending and approval notification emails to LU YI. The submission describes email as not designed and API.md assumes no external caller. Confirm scope and callers rather than silently omitting notifications.
- Site still uses legacy point/edge and `point.opened` terminology in places, and mentions worker replay. Current architecture/code use task and the documented restart behavior differs. Do not import old model/message names from the prototype into contracts.

## Delivery rules

Write repository content in English and team discussion in Chinese. Use shared UI components and theme tokens. Test pattern behavior first. Keep work within the slice, use small Conventional Commits, and require `npm run verify`, CI and owner review before calling a story done.
