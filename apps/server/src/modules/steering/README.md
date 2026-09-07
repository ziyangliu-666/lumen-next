# steering — LI ZHUOYANG

**Use case:** UC4 — steer a running session, run a command
**Covers:** worker, compute, storage — running an agent, executing commands in a sandbox, file storage

## The design problem (from the proposal, section 6.4)

A user message must be queued and applied at a chosen moment inside a running
turn, and must be cancellable before it lands. The compute provider behind the
same use case must also be replaceable, including a provider that does nothing.

**Candidate pattern:** Command, compared with Strategy and Null Object. This is
the starting hypothesis from the proposal, not the conclusion. You compare the
candidates, pick one, and write down why.

## You design this slice

This folder is empty on purpose: a README and an empty `index.ts`. Nobody has
decided your classes for you. Write the design first (use case flow, analysis
class diagram, the pattern and why) in your own design doc, then build it here
with a unit test for every class that carries the pattern.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/steering`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
