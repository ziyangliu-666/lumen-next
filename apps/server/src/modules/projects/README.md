# projects — PENG XUJIAN

**Use case:** UC2 — start a project, review what ran while away
**Design pattern:** State

**Covers:** projects, findings — project management, and the finding cards shown on Home and in a session

A project is running, waiting on the user, finished or stopped. Each state renders and advances differently. The conditional logic must not scatter across list, card and poller.

## Boundary
Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/projects`, never a file inside it. You own
every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here
See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
