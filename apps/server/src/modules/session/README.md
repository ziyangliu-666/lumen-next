# session — LIU ZIYANG

**Use case:** UC3 — delegate work and read the trace
**Design pattern:** Composite

**Covers:** kernel, broker — the delegation engine and event fan-out (call records, the call tree). The shared core and contracts are also under this slice

A task and a subtree of tasks answer cost, cancellation and rendering the same way. Cost rolls up through the tree.

## Boundary
Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/session`, never a file inside it. You own
every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here
See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
