# session — LIU ZIYANG

**Use case:** UC3 — delegate work and read the trace
**Design pattern:** Composite

**Covers:** kernel, broker — the delegation engine and event fan-out (call records, the call tree). The shared core and contracts are also under this slice

A task and a subtree of tasks answer cost, cancellation and rendering the same way. Cost rolls up through the tree.

## What is here (Sprint 1)

The walking skeleton from the proposal, §8.1: sign in (stub), one project, one
session, one task, one step, rendered end to end.

| File | Role |
|---|---|
| `trace.ts` | The `Trace` interface: the record of sessions, tasks and steps. |
| `pgTrace.ts` | The record in Postgres, used when the process has a `Db`. |
| `memoryTrace.ts` | The record in memory, for a process without `DATABASE_URL` and for kernel unit tests. |
| `traceContract.ts` | One test suite, run against both implementations so they cannot drift. |
| `kernel.ts` | The engine. Opens the root task, runs the worker, and is the `WorkerReport` the worker writes through. Owns the "who may read this session" answer. |
| `delegation.ts` | The two bounds on a fan-out: how deep the tree may go, and how many children run at once. |
| `stepDetail.ts` | What a step may carry. Checks the shape a worker hands in, makes the text storable in Postgres, and cuts output and rows to their bounds before the write. |
| `demoWorker.ts` | A worker with no model: a lead that searches and fans out to three readers, each of which searches for $0.01, runs something, keeps a finding and replies. `LUMEN_DEMO_PACE_MS` sets how long each step waits. Steering replaces it behind `core/domain/worker.ts`. |
| `directory.ts` | `SessionDirectory`: what the projects slice is handed (start, list, stop, context, taskSession). Trusted in-process calls. |
| `routes.ts` | `POST /api/projects/:id/sessions`, `GET /api/sessions/:id`, `POST /api/sessions/:id/stop`; commands `session.say`, `session.stop`. |
| `taskComposite.ts` | The Composite the design problem asks for, and `buildTree`, which turns task rows into it. The kernel uses it for the session's spend, each task's rolled-up total, and stop. |

## Public index

```ts
export function createSessionSlice(deps: {
  broker: Broker; worker?: Worker; db?: Db | null;
  requireProject?: ProjectGate;   // from projects: may this principal use this project?
  budget?: BudgetGuard;           // from billing: asked at turn, fan-out and task-open
  recordSpend?: SpendRecorder;   // from billing: ledger write in the trace transaction
  recordFinding?: FindingSaver;   // from projects: where findings are kept
}): SessionSlice;
// SessionSlice = { kernel, access, registerRoutes, registerCommands, projects: SessionDirectory }
export { buildTree, TaskNode, type Node, type Kernel };
export { demoWorker, paceFromEnv, type DemoOptions };
```

`main.ts` builds the server with `access` and registers the routes and commands.

## Boundary
Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/session`, never a file inside it. You own
every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here
See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.

With Postgres, `recordSpend(entry, tx)` and the task cost commit or roll back
together. Billing receives the task owner from the session record, never a
browser-supplied account. The callback is not used in MemoryTrace development
mode, where billing reports database unavailability instead of a fake wallet.
