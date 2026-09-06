# Definition of Done

Chandra's approval asked for a Definition of Done for every sprint. There are two
layers: a story-level DOD that never changes, and a sprint-level DOD that is the
demonstrable goal of each two-week block.

## Story DOD (applies to every story, every sprint)

A story is Done when:

1. The behaviour has a passing unit test. For a story that introduces or changes a
   design-pattern class, the test exercises the pattern's reason for existing.
2. `npm run verify` is green: format, lint, typecheck, and coverage at or above the
   sprint's gate.
3. No import crosses into another slice's internals.
4. The change is a reviewed, merged pull request — the slice owner reviewed it and
   the CI pipeline (CI + Security + Deploy build) passed.
5. Any change to a slice's public barrel is reflected in its README.

## Sprint DOD

Every sprint runs CI, CD and security testing (SCA, SAST, and — from Sprint 2 —
DAST). Each sprint also has one demonstrable outcome.

| Sprint | Dates | Sprint is Done when |
|---|---|---|
| 1 | 2–12 Sep | The shared contract (domain model, event protocol, base schema) is frozen and the pipeline skeleton is green. A walking skeleton runs: sign-in stub, one project, one session, one point, rendered end to end. Every slice has its pattern skeleton and a passing test. |
| 2 | 15–26 Sep | Slices run in parallel. A question fans out to workers and the tree is readable and costed. Sandbox behind its interface. Wallet shows spend; ledger writes. Container image builds; DAST runs against staging. |
| 3 | 29 Sep–10 Oct | A session is steerable from the composer and stays inside its cap; an over-cap step escalates for approval. Restore after a restart. GitHub and Google OAuth work. Stripe top-up works in test mode. |
| 4 | 13–24 Oct | Design-pattern refactors applied and documented (brute force → pattern, before/after). Integration across slices. Hardened. Report and presentation ready. |

## Not Done

A story is not Done because the code exists. It is not Done until the test proves
the behaviour, the pipeline is green, and the owner has reviewed it.
