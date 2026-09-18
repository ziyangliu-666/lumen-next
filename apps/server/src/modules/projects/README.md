# projects — PENG XUJIAN

**Use case:** UC2 — start a project, review what ran while away
**Covers:** projects, findings — project management, and the finding cards shown on Home and in a session

## The design problem (from the proposal, section 6.4)

A project card renders and refreshes differently when it is running, waiting on
the user, finished or stopped. The conditional logic is spread across the list,
the card and the poller.

**Candidate pattern:** State. This is the starting hypothesis from the proposal,
not the conclusion. You compare the candidates, pick one, and write down why.

## Implementation status

The first pattern story implements `ProjectCardContext` and six State classes.
Together they project a confirmed `TaskStatus` into one descriptor containing
the card label, semantic tone, available actions, and refresh policy. The context
accepts authoritative snapshots without owning the session lifecycle.

See [the before/after record](CARD_STATE.md) for the brute-force approach,
refactor, tests, and remaining integration work. These classes are internal;
`index.ts` still exports no public API. Routes and Home integration await an
agreed read model and session public operations.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/projects`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
