# projects — PENG XUJIAN

**Use case:** UC2 — start a project, review what ran while away
**Covers:** projects, findings — project management, and the finding cards shown on Home and in a session

## The design problem (from the proposal, section 6.4)

A project card renders and refreshes differently when it is running, waiting on
the user, finished or stopped. The conditional logic is spread across the list,
the card and the poller.

**Candidate pattern:** State. This is the starting hypothesis from the proposal,
not the conclusion. You compare the candidates, pick one, and write down why.

## You design this slice

This folder is empty on purpose: a README and an empty `index.ts`. Nobody has
decided your classes for you. Write the design first (use case flow, analysis
class diagram, the pattern and why) in your own design doc, then build it here
with a unit test for every class that carries the pattern.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/projects`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
