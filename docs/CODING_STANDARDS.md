# Coding standards

These are enforced by `npm run verify`, not by review comments. If the command is
green, the standard is met.

## Language and style

- TypeScript in `strict` mode, plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` and `verbatimModuleSyntax`. No `any`; use `unknown`
  and narrow.
- Prettier owns formatting (100 columns, single quotes, trailing commas). Never
  hand-format; run `npm run format`.
- ESLint (`typescript-eslint` type-checked rules). Floating promises are errors.
  Public functions declare their return type.
- Names say what a thing is for, from the reader's side. Money is integer cents,
  never a float.

## The slice boundary (the load-bearing rule)

- Each slice lives in `apps/server/src/modules/<slice>/`.
- Everything a slice offers the rest of the monolith is re-exported from its
  `index.ts`. Nothing else is importable — ESLint blocks `modules/<other>/<file>`.
- A slice may import `core`. `core` may never import a slice.
- This is what keeps it a **modular monolith**: one process, but boundaries that
  five people (and five agents) do not cross by accident.

## Commits and branches

- Conventional Commits: `feat(session): …`, `fix(billing): …`, `refactor: …`,
  `test: …`, `docs: …`, `build: …`, `ci: …`.
- One branch per story, named `<slice>/<short-topic>`. Open a pull request; merge
  after the owner's review and a green pipeline. Trunk-based: branches are short.

## Tests

- Vitest. A test file sits next to what it tests: `foo.ts` -> `foo.test.ts`.
- Every design-pattern class ships with a unit test that exercises the behaviour
  the pattern exists for (cost roll-up, state transition, guard chain, …).
- Coverage is measured on every run. The gate rises each sprint; see below.
- Write the test first for the complex classes (the delegation engine, the budget
  chain, the state machine). Trivial glue does not need a test.

## Coverage gate by sprint

| Sprint | Lines (domain: contracts + core + modules) |
|---|---|
| 1 | 60% |
| 2 | 65% |
| 3 | 70% |
| 4 | 70% held |
