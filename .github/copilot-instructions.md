# Review instructions for this repository

lumen is a modular monolith written by five people and five agents at once.
Review a pull request against the rules below. They are the team's own rules;
each one exists to stop five people from producing five codebases.

Read first, in this order: `docs/ARCHITECTURE.md`, `docs/CODING_STANDARDS.md`,
`docs/UI.md`, `docs/SLICES.md`, `docs/DOD.md`.

## What to check

1. **The slice boundary.** Server code for a slice lives in
   `apps/server/src/modules/<slice>/`. A slice imports another slice only through
   its public index (`modules/<name>`), never a file inside it. `core` imports no
   slice. A pull request that reaches across a boundary is wrong even if it works.
2. **English only.** Everything git tracks is English: code, comments, test
   names, error strings, commit messages, docs. The two Chinese documents
   (`README.md`, `docs/ONBOARDING.md`) are the whole exception. A comment that
   explains *why* must keep the reason when it is in English.
3. **One look for the web app.** A page builds from `apps/web/src/ui/` and
   colours only with the theme classes from `apps/web/src/styles/theme.css`. No
   hex colour, no `style={{ … }}`, no CSS file per page, no new UI dependency, no
   import from another page.
4. **Money is dollars**, a JS number for transport and display. The column is
   `numeric(12,6)`, sums happen in SQL, the browser formats to four decimals and
   never adds.
5. **The contract is shared.** A change under `packages/contracts/` or
   `apps/server/src/core/` affects every slice. Flag it, and check that the
   owner of that path is a reviewer.
6. **Tests prove the pattern.** A class that carries a design pattern (the
   delegation engine, the budget chain, the state machine, the auth flow) has a
   unit test that exercises the reason the pattern exists. Trivial glue does not
   need a test.
7. **Names from the glossary.** The unit of work is a *task*, shown in a *call
   tree* as a list of *steps*. Do not accept *point*, *edge*, *graph*, *node*,
   *tenant* or *barrel* as new vocabulary; see the glossary at the end of
   `docs/ARCHITECTURE.md`.
8. **Commits and branches.** Conventional Commits (`feat(session): …`), one
   branch per story named `<slice>/<topic>`, and the pull request template's
   Definition of Done boxes ticked honestly.

## What not to flag

- Formatting. Prettier owns it and CI checks it.
- Files under `apps/web/src/ui/`. They are vendored shadcn/ui sources.
- Style preferences that no rule above names.

When a finding is a matter of the rules above, quote the rule. When it is a
judgement call, say so.
