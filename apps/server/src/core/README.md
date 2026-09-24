# core — shared, frozen after Sprint 1

The contract every slice builds against. Frozen at the end of Sprint 1.

- `domain/` — entities and the task model, and the interfaces two slices share without importing each other: `worker.ts` (session and steering), `budget.ts` (session and billing), `money.ts` (the one rule for an amount about to be recorded)
- `model/` — the one door to a language model: `ModelProvider` (`complete(request)` → text, tool calls, tokens, cost), `OpenAICompatible` for every vendor that speaks chat completions (OpenAI, DeepSeek), `nullModel` for CI and a demo without a key, the price table, and `modelFromEnv`. A worker asks it and never sees a key or a wire format; what a call cost goes on the step as `detail.cost`.
- `log/` — the one logger (pino): `createLog`, `nullLog`, `taskLog`. Fastify and every slice write through it; a worker gets a task-scoped child on its `WorkerReport`. What goes in a line, and what never does, is in `docs/LOGGING.md`.
- `protocol/` — the broker: turns domain events into `@lumen/contracts` `ServerEvent`s
- `db/` — `openDatabase(url)` returns the one `Db` (pool, `query`, `withTransaction`); `migrations/NNN_<slice>_<what>.sql` run at startup through node-pg-migrate. A slice is handed a `Db`; it never imports `pg`. There is one migrations directory, this one. Take the next free number; if another branch merges first with a lower or equal number, do not renumber: files are applied by name whether or not a higher one already ran (`checkOrder: false`), so only a duplicate file name is a conflict.
- `http/` — process bootstrap, middleware, the auth guard every route passes through

No file here may import a slice. Slices import core, never the reverse.
