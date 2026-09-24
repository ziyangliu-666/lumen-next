# Identity delivery scope

## Included in this change

- Explicit GitHub/Google OAuth configuration with value-free validation errors,
  independent provider enablement, fixed callbacks and an opt-in loopback-only
  development exception. Production defaults remain HTTPS.
- AccountSettings and AccountActions components for reviewed shell composition.
- Shared-auth refresh after successful password login/signup and account changes.
- Compact signin/account layouts and honest provider availability/retry feedback.
- Unit, SSR and real-PostgreSQL tests for these changes.
- Startup wiring in `main.ts` and `app.ts`, approved by the core owner, that
  passes configured OAuth providers to the slice.
- Shell and Settings composition in `core/shell.tsx`, `main.tsx` and
  `Settings.tsx`: the header account slot, nested Settings routes and the
  Account tab as a content slot. `Settings.tsx` awaits its owner's answer on
  the pull request.

## Shared files touched

These files belong to other owners and are changed here with their review:
`apps/server/src/main.ts`, `apps/server/src/app.ts`, `apps/web/src/core/shell.tsx`,
`apps/web/src/main.tsx` and `apps/web/src/pages/settings/Settings.tsx`. Global
shell spacing is unchanged; it is a separate shell decision.

## Validation

The latest full verification with disposable real PostgreSQL passed 664 tests in
59 suites with no skips. Format, lint, strict typecheck and coverage gates passed;
whole-domain line coverage was 98.28%. Standard builds also passed. Coverage is
not a feature-completion percentage.

The proposed frontend composition was typechecked and built in a local preview.
Browser checks covered normal-user account flows, layout at normal zoom, provider
availability, failed-request feedback and duplicate-signout suppression. Both
provider options were enabled together. Real Google and GitHub login outcomes
were confirmed locally as described in the setup guide.

The full CI, security, staging and owner-review requirements still apply to the
submitted revision. Historical local checks do not substitute for those gates.

## Remaining work

| Goal | Remaining delivery requirement |
| --- | --- |
| Application acceptance | Staff routing and cross-account browser checks. |
| Account composition | Settings owner answer on the pull request, then merge. |
| OAuth | Review/apply startup wiring; deployment-owned HTTPS configuration; remaining live negative/logout/staff cases; Arctic maintenance review. |
| Mail verification/recovery | Reviewed durable delivery design addressing the timing-enumeration blocker, retry/abuse controls and real mailbox acceptance. Public recovery remains disabled. |
| Account deletion | Team retention policy, reauthentication/revocation design, transaction tests and implementation. No destructive endpoint is enabled. |
| Final DOD | Reviewed PR, green CI/security/deployment gates and staging acceptance. |

Existing WebSockets retain their handshake principal after authentication state
changes; immediate revalidation requires shared-core work. Same-email provider
accounts are not automatically linked. Neither limitation is silently treated
as completed work.

## Privacy of the delivery

Only source, synthetic test fixtures and sanitized technical documentation are
included. Local credentials, OAuth application identifiers, personal test-account
identities, browser captures/profiles, machine-specific launchers, databases,
private documents and work logs are excluded. No personal OAuth application or
account access is transferred with this code. Each deployment supplies its own
private configuration.
