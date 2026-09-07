# identity — LU YI

**Use case:** UC1 — sign up, sign in, manage the account
**Covers:** identity, email — sign-in, accounts, OAuth, email verification

## The design problem (from the proposal, section 6.4)

Four ways to become authenticated: GitHub, Google, email with password, and an
existing session. Each exchange differs, all of them must end in one session, and
a fifth must not change the session code.

**Candidate pattern:** Strategy with Template Method. This is the starting
hypothesis from the proposal, not the conclusion. You compare the candidates,
pick one, and write down why.

## You design this slice

This folder is empty on purpose: a README and an empty `index.ts`. Nobody has
decided your classes for you. Write the design first (use case flow, analysis
class diagram, the pattern and why) in your own design doc, then build it here
with a unit test for every class that carries the pattern.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/identity`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
