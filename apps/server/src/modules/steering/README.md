# steering — LI ZHUOYANG

**Use case:** UC4 — steer a running session, run a command
**Design pattern:** Command (with Strategy / Null Object for compute)

**Covers（这条线包含的细模块）:** worker, compute, storage — agent 运行、沙箱执行命令、文件存储

A user message is queued and applied at a chosen moment in a running turn, and is undoable before it lands. The compute provider behind the same slice is replaceable, including a provider that does nothing.

## Boundary
Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/steering`, never a file inside it. You own
every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here
See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
