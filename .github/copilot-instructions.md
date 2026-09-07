# Review instructions for this repository

lumen is a modular monolith written by five people and five agents at once.
Prettier, ESLint, the TypeScript compiler and the test run already check
formatting, the import boundary between slices, theme colours and types. Do not
repeat them. Review what a machine cannot see.

Read first: `docs/ARCHITECTURE.md` (sections 2, 6, 7 and the glossary),
`docs/CODING_STANDARDS.md`, `docs/DOD.md`.

## Check these

1. **Every route checks who is calling.** A handler registered on the router
   calls `requireUser(req)` or `requireStaff(req)` before it reads or writes
   anything. A route without one lets anyone read another account's data. Flag it
   as a blocker.
2. **SQL stays inside the slice that owns the table.** ESLint blocks imports
   across slices; it cannot see a query string. A slice reads another slice's
   table only through that slice's public index. Table ownership is in
   `docs/ARCHITECTURE.md`, section 3.
3. **A change to the shared contract is called out.** Anything under
   `packages/contracts/` or `apps/server/src/core/` affects every slice. Say so
   in the review and check the pull request explains why.
4. **The test proves the reason the pattern exists.** A class that carries a
   design pattern has a test for the behaviour the pattern was chosen for: the
   budget chain escalates instead of refusing, the project card polls only while
   live, cancelling a task cancels its subtree. A test that only checks the happy
   path does not count.
5. **Comments and names.** English only. A comment that explains why must keep
   the reason. The unit of work is a *task*, shown in a *call tree* as *steps*;
   do not accept *point*, *edge*, *graph*, *node* or *tenant* as new words. The
   glossary is at the end of `docs/ARCHITECTURE.md`.
6. **Ordinary bugs.** A promise that is not awaited, a null that is not
   handled, an error caught and dropped, a loop that can run forever, input from
   the browser used without validation.

## Do not flag

- Formatting, import order, class-name order. Prettier and ESLint own them.
- Files under `apps/web/src/ui/`. They are vendored shadcn/ui sources.
- Style preferences no rule above names.

Quote the rule when a finding comes from one. Say so when it is a judgement.
