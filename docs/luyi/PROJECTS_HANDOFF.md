# Identity integration design: projects (PENG XUJIAN)

Owner of identity: LU YI. Owner of projects/findings/Home: PENG XUJIAN.
Status: proposed integration design, 2026-09-18. The current projects public
index is empty and Home renders an example card. No real project ownership
implementation or acceptance is claimed here.

## 1. What projects receives

Core mounts the real identity resolver once. Every protected projects route then
uses core's requireUser(request), yielding a trusted `{ accountId, role }`.
Projects does not need an extra identity HTTP endpoint or its own login session.

| Data | Source | May it authorize a request? |
|---|---|---|
| principal.accountId | Server-resolved login cookie | Yes, after resource ownership is checked |
| principal.role | Current database role at HTTP authentication | For explicitly approved staff policy only |
| GET /api/me account | Safe browser display and shell login state | No, browser state is not proof |
| body/query accountId, ownerId or email | Client input | Never |
| Project/session ID | URL or command input | Identifies a target, never grants access |

Do not import identity private files, query accounts directly, accept a stub
header after real auth is mounted, or use billing's admin listAccounts/getAccount
as a general authentication mechanism.

## 2. Ownership model and resource flow

Each project has one server-assigned account_id. The base schema already has this
column, but durable project behavior remains projects-owned. Creation must set
account_id from requireUser(request).accountId, never from request JSON.

```text
cookie -> core resolver -> principal
                              |
request projectId -> projects lookup(projectId, principal.accountId)
                              |
                        authorized project
                              |
                  session start / findings / stop
```

Scope queries by owner where practical, e.g. a parameterized project lookup by
both id and account_id. A successful identity check alone does not make every
project readable. Do not return another owner's project before filtering it in
the browser. Apply checks to counts, spend summaries, findings and activities,
not just the title/details route.

## 3. Planned HTTP boundary

These routes come from the architecture; they are not implemented by this doc.

| Route | Required check/behavior |
|---|---|
| GET /api/projects | requireUser; list only that account's projects, including only its aggregates |
| POST /api/projects | requireUser; validate question/mode and mutation Origin; assign owner from principal; create project + start first session with approved consistency semantics |
| GET /api/projects/:id | requireUser; match project ownership before returning details |
| POST /api/projects/:id/stop | requireUser; check ownership and Origin before stopping any work |
| GET /api/projects/:id/findings | requireUser; check project ownership before returning findings |

Anonymous = 401. Unknown or inaccessible project = consistent 404. Invalid
request = 400; untrusted mutation Origin = 403. Errors use core's current
`{ error: string }` response. Sensitive per-account responses should use an
appropriate private/no-store policy, not a public cache keyed only by URL.

Reject caller-supplied owner/account fields or explicitly omit them via a strict
input schema. Do not spread a request body into database insert/update fields.
Define idempotency/compensation for create-project + start-session before
claiming those two operations are atomic; the current session kernel is in-memory.

Identity's Origin hook does not protect projects routes, because it is an
encapsulated plugin. Add/reuse an owner-reviewed mutation CSRF policy. Existing
browser fetch calls use same-origin cookies and should not add token headers.

## 4. Ownership functions to agree with session and steering

These are proposals for PENG XUJIAN's public index, NOT existing exports:

```ts
// Proposed minimal shape; names/errors require owner agreement.
interface ProjectIdentity {
  readonly id: string;
  readonly accountId: string;
}

// Authorize an existing project before creating a session under it.
function requireOwnedProject(
  projectId: string,
  accountId: string,
): Promise<ProjectIdentity>;

// Already proposed in ARCHITECTURE.md; internal lookup, not authorization alone.
function projectOf(sessionId: string): Promise<ProjectIdentity>;
```

requireOwnedProject must not reveal whether a foreign ID exists and must fail
before side effects. An internal projectOf result still needs comparison with
the requesting principal. Do not export raw mutable records as shared state.

The distinction matters: session's POST /api/projects/:id/sessions currently
trusts projectId. projectOf(sessionId) cannot secure this operation before the
new session exists. Session must call a project-by-ID owner check first; projects
must not read session internals to patch around the missing interface.

Steering also needs task -> session and steer -> task resolution owned by the
respective slices, then project ownership. Whether these lookups are coordinated
through injected functions or existing public indexes is for the owners to
agree; identity should not create a second ownership registry.

Internal calls run inside the trusted monolith. They do not eliminate the HTTP/
command caller's authorization obligation. If role-based staff access is needed,
agree an explicit Principal-aware policy instead of bypassing all checks for
staff in one slice while forbidding it elsewhere.

## 5. Home and shell integration

- Shell owns the shared login state from GET /api/me; Home consumes it instead of
  reading lumen_stub/document.cookie or maintaining a separate identity source.
- The /api/me result uses id; the server Principal uses accountId. Keep this
  distinction explicit and do not send the browser's ID as owner authority.
- On successful login, Home fetches GET /api/projects. It does not seed the server
  with a browser-selected account ID.
- Empty project list is a valid empty state, not a login failure.
- 401 asks shell to invalidate login state; network/5xx errors are retryable errors,
  not an empty account or proof that the user is anonymous.
- Clear/refetch user-scoped caches when accounts change or sign out. Avoid showing
  the previous user's cards, findings, spend or activity after a new login.
- Session navigation uses IDs returned by authorized server operations, not
  authorization inferred from a visible card.

## 6. Suspension and account lifecycle

Suspension revokes login sessions. New HTTP requests then fail authentication;
unsuspension requires a fresh login. It does not delete project data, rewrite
project owners, stop already-running workers or close existing sockets. Those
resource/work lifecycle actions require an explicit cross-slice admin workflow.

Account deletion is not implemented. Do not add cascading deletion of projects,
sessions or financial records on identity's behalf. Agree retention and worker
stop behavior with session/billing before adding DELETE /api/me.

## 7. Acceptance plan for actual projects implementation

Create users A and B using real identity cookies, then:

1. A creates a project while attempting to supply B's accountId. Reject the extra
   field or create only an A-owned project; never write B as owner.
2. Each list contains only its owner's cards, counts, spend and findings.
3. B cannot read, stop or list findings for A's project; use the same 404 as an
   unknown ID and verify no side effects occurred.
4. B cannot start a new session under A's project ID. No session or task is created.
5. A can start/read/stop its own flow, with matching principal across HTTP/WS.
6. Missing/expired/revoked cookies and forged stub headers cannot access projects.
7. After suspension and unsuspension, the old cookie remains rejected; fresh login
   restores access to retained projects without changing ownership.
8. Foreign-Origin mutations fail; malformed IDs/input and database errors fail
   safely without leaking another account's data.
9. Login as B after A and confirm no A data remains in Home's cache/UI.
10. Test staff read/control behavior only after the shared policy is agreed.

Identity already has cookie/role/revocation tests. Steering handoff tests use
fixture ownership maps, not a real project database. All project-specific cases
above remain pending until PENG XUJIAN implements the public interface/routes.
Run them again against PostgreSQL, not only the local PGlite fixture.

## 8. Questions to confirm with PENG XUJIAN and LIU ZIYANG

- Approve the project-by-ID ownership interface and missing/foreign error policy.
- Decide whether staff may view/control foreign projects and align all slices.
- Decide consistency/retry semantics of project + initial-session creation.
- Confirm who publishes task/session -> project ownership lookups for steering.
- Confirm shell cache invalidation and projects mutation CSRF policy.

No projects, session, shell or shared contract file is modified by this design.
