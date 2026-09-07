# core — shared, frozen after Sprint 1

The contract every slice builds against. Frozen at the end of Sprint 1.

- `domain/` — entities and the task model
- `protocol/` — the broker: turns domain events into `@lumen/contracts` `ServerEvent`s
- `db/` — one Postgres pool, the schema, migrations
- `http/` — process bootstrap, middleware, the auth guard every route passes through

No file here may import a slice. Slices import core, never the reverse.
