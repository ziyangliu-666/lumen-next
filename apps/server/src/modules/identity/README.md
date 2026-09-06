# identity — LU YI

**Use case:** UC1 — sign up, sign in, manage the account
**Design pattern:** Strategy + Template Method

Four ways to become authenticated (GitHub OAuth, Google OAuth, email + password, an existing session) share one flow and end in one principal. A fifth must not change the flow.

## Boundary
Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/identity`, never a file inside it. You own
every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here
See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
