# Coding standards

Almost all of these are enforced by `npm run verify`, not by review comments. If
the command is green, that part of the standard is met. The first rule below is
the exception: no command reads English, so the reviewer does.

## The repository is in English

Everything git tracks is English. Code, comments, docstrings, test names,
assertion messages, error strings, Markdown documents, commit messages, pull
request titles and bodies, and comments in config files.

The team speaks Chinese, and this repository has Chinese documents in it on
purpose: `docs/ONBOARDING.md` is for the five of us. That is the whole exception.
The moment text is going to be read by somebody outside this room — a marker, a
future maintainer, a tool — it is English.

Two things follow from this, and both are easy to get wrong:

- **Write it in English the first time.** Do not write a Chinese comment and
  translate it later. A translation pass is a pass nobody schedules.
- **A translation keeps the reasoning.** A comment that explains *why* a guard
  exists, and names the failure it prevents, has to say the same thing in
  English. Compressing it to "Validate the input" deletes the only part worth
  reading.

Tell your agent this too. It is in `/CLAUDE.md`, which Claude Code and Codex read
by themselves, but an agent you drive from somewhere else needs to be told.

## TypeScript and style

- TypeScript in `strict` mode, plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` and `verbatimModuleSyntax`. No `any`; use `unknown`
  and narrow.
- Prettier owns formatting (100 columns, single quotes, trailing commas). Never
  hand-format; run `npm run format`.
- ESLint (`typescript-eslint` type-checked rules). Floating promises are errors.
  Public functions declare their return type.
- Names say what a thing is for, from the reader's side. Money is dollars: the
  column is `numeric(12,6)`, sums happen in SQL, the browser formats to four
  decimals and never adds.

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
- The message, the branch name and the pull request are English, like everything
  else git keeps.

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
