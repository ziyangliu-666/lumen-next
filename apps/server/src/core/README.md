# core — shared, frozen after Sprint 1

The contract every slice builds against. Frozen at the end of Sprint 1.

- `domain/` — entities and the task model
- `protocol/` — the broker: turns domain events into `@lumen/contracts` `ServerEvent`s
- `db/` — `openDatabase(url)` returns the one `Db` (pool, `query`, `withTransaction`); `migrations/NNN_<slice>_<what>.sql` run at startup through node-pg-migrate. A slice is handed a `Db`; it never imports `pg`.
- `http/` — process bootstrap, middleware, the auth guard every route passes through

No file here may import a slice. Slices import core, never the reverse.
