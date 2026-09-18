# Identity handoff to steering (LI ZHUOYANG)

Date: 2026-09-18. Scope: authentication/authorization boundary only. The current
branch has no steering implementation beyond its README and public index. This
handoff does not claim that uploads, files, workers or steering commands work.

## What identity supplies

No separate steering login endpoint, token or account database is needed.
Core creates one identity instance with createIdentitySlice from the public index,
passes identity.principalResolver to buildServer, and registers identity.registerRoutes.
That resolver authenticates the lumen_session cookie for both HTTP and WebSocket
handshakes, producing `{ accountId, role: 'user' | 'staff' }` or null. The development
stub header/cookie is not a credential for it.

- POST /api/auth/signup and POST /api/auth/password issue the HttpOnly cookie.
- GET /api/me supplies the browser's current account; do not read the cookie in JS.
- POST /api/auth/signout revokes one login session; signout-all revokes all.
- suspend(accountId, true) atomically revokes all login sessions. Unsuspending
  does not restore cookies; fresh login is required.
- The next HTTP request or new socket handshake rechecks stored identity, current
  role/suspension, expiry and revocation. It does not validate a resource owner.

Server routes use core's requireUser(request); they do not parse cookies, accept
an accountId from the client as identity, or call admin getAccount as a substitute
for authentication. The admin account interface is not needed by steering.

## Steering's responsibilities

These are planned production endpoints, not new routes added by this handoff:

| Surface | Identity input | Resource authorization owned by steering and its collaborators |
|---|---|---|
| GET /api/projects/:id/files | requireUser(request) | Resolve project ownership and compare to principal.accountId. |
| GET /api/projects/:id/files/* | requireUser(request) | Same owner check, plus normalize paths and prevent traversal/symlink escapes. |
| POST /api/sessions/:id/attach | requireUser(request) | Resolve session -> project -> owner; check before saving/processing upload. Enforce size/content/path limits and CSRF protection. |
| task.steer | broker handler's principal argument | Resolve task -> session -> project -> owner before enqueuing a command. |
| steer.cancel (not wired yet) | future broker principal argument | Resolve steer -> task -> project owner before cancellation, not merely a guessed steerId. |

Use projects/session public indexes for ownership lookup, not their private files
or tables. Those lookup functions must be agreed with PENG XUJIAN/LIU ZIYANG;
identity does not know project/task ownership. The test fixture uses strict owner
checks, not a decision that staff may or may not operate any user's resources.
Agree that staff policy explicitly before implementing privileged access.

Return 401 for unauthenticated requests. A consistent 404 for inaccessible/missing
resources avoids exposing whether another person's ID exists. Error messages
currently use core's `{ error: string }` format.

Identity's mutation Origin hook is scoped to its own Fastify plugin. It does NOT
protect steering's upload route. Steering needs its own reviewed CSRF/Origin
check; the fixture demonstrates an exact trusted Origin check. Multipart parsing,
file constraints and actual storage are not implemented/tested here.

## Current WebSocket wire (code, not the future architecture diagram)

```text
GET /ws?session=<sessionId>   # cookie checked before upgrade
{"type":"task.steer","taskId":"...","text":"...","when":"next-step"}
```

`when` also accepts `end-of-turn`. Core uses SessionAccess.canWatch to authorize
the session before upgrade. The broker invokes the task.steer handler with a
server-resolved principal. Extra client accountId/role fields are discarded by
the parser; they never elevate privilege.

The session subscription check is NOT a task-owner check. task.steer carries a
taskId, not a sessionId; steering must resolve and authorize its target. Core
cannot infer which task/session a command belongs to. Do not enqueue first and
check afterward.

### Confirmed blockers requiring owner review

1. **Open sockets retain the handshake principal.** The real transport test shows
   a task.steer frame still reaches the fixture handler after that account is
   suspended, while a new socket gets 401. This is a characterization of a gap,
   not a security acceptance. Revocation-aware socket closure or per-command
   session revalidation must be designed with core. Re-reading an account alone
   does not detect signout of one session; current handlers do not receive a
   session credential. Do not invent a client-supplied token to work around it.
2. **steer.cancel is absent from both ClientCommand and parseCommand.** The parser
   currently drops it. Add it via a reviewed contracts/core change, not a private
   message format in steering. Proposed steer.queued/landed/cancelled events are
   also not present in the current ServerEvent union.
3. **WebSocket Origin validation is not implemented in wsBridge.** SameSite=Lax
   is not a complete Origin policy. Agree and test handshake Origin enforcement
   with core before deployment; identity's HTTP plugin hook does not cover /ws.
4. **Production wiring is pending.** main.ts still uses headerStub. The local
   identity harness deliberately denies session WebSocket access and does not
   register steering. These tests build a separate real-auth server.

## Executable evidence

File: apps/server/src/modules/identity/steeringHandoff.test.ts.

Real components: PGlite with actual schema/stores, password login, cookies,
identity resolver, core HTTP server, core WebSocket transport, broker and parser.
Test doubles: project/session/task ownership maps, file/attachment handlers and
a task handler that records authorization decisions but performs no side effects.
The fake endpoints exist only inside tests, not in the local or production app.

Five tests cover:

1. File-list/attachment probes: anonymous 401, owner allowed, other owner 404,
   forged stub rejected, missing resource 404 and untrusted mutation Origin 403.
2. Real WS: anonymous 401, foreign session 404, owner handshake succeeds;
   task frames get the cookie principal, and the fixture rejects a foreign task.
3. Signout/suspension: fresh connections and HTTP requests reject old cookies,
   including after unsuspension.
4. The existing-open-socket revocation gap above (deliberately documented).
5. The unsupported steer.cancel parser behavior (deliberately documented).

Run from the repository root after installing the local tool per LOCAL_AUTH.md:

```powershell
$env:IDENTITY_PGLITE_MODULE = Join-Path (Get-Location) 'tmp/identity-tools/node_modules/@electric-sql/pglite/dist/index.js'
npx vitest run apps/server/src/modules/identity/steeringHandoff.test.ts
npm run verify
Remove-Item Env:IDENTITY_PGLITE_MODULE
```

Full verify with engine enabled: 265 tests pass, 89.56% line coverage. Replace
fixture handlers with actual steering routes/commands when that slice lands,
then repeat the matrix against PostgreSQL and include multipart/path constraints,
command effects/cancellation and revocation on already-open sockets. No steering,
core, shared contract or production entry-point file was modified here.
