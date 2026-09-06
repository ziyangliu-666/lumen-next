# lumen

A web workspace where AI agents delegate to each other, and the call tree is a
graph you can stand inside and steer. SWE5006 Practice Module, Team 1.

**One rule:** a point is the lifetime of one agent context window. Every event
that opens a window opens a point on the graph, and nothing else does.

## Shape

One monolith, one relational database, one React client. No microservices and no
public API between the parts — the slices call each other in-process through their
public barrels. The code is organised by **vertical slice**, so one person owns a
use case end to end: its pages, its back-end module, and its pipeline jobs.

```
packages/contracts   the shared event protocol and domain types (frozen after Sprint 1)
apps/server          the monolith
  src/core           domain, protocol/broker, db, http — shared, owned by the PM
  src/modules        one folder per slice, one owner each
apps/web             the React client, one folder per page
```

| Slice | Owner | Use case | Design pattern |
|---|---|---|---|
| identity | LU YI | Sign in, account, OAuth | Strategy + Template Method |
| projects | PENG XUJIAN | Start a project, review home | State |
| session | LIU ZIYANG | Delegate, read the trace | Composite |
| steering | LI ZHUOYANG | Steer a run, run a command | Command + Null Object |
| billing | HE RONG | Cap spend, admin, Stripe | Chain of Responsibility |

Start with [docs/ONBOARDING.md](docs/ONBOARDING.md) (Chinese) for how to pick up
work with an agent. See [docs/SLICES.md](docs/SLICES.md) for the full boundary of
each slice, [docs/DOD.md](docs/DOD.md) for the Definition of Done, and
[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) for how we write and test code.

## Running it

```bash
npm install
docker compose up -d db          # local Postgres
npm run verify                   # format, lint, typecheck, test with coverage
npm run dev --workspace @lumen/server
npm run dev --workspace @lumen/web
```

Node 22+. Copy `.env.example` to `.env` and fill in the secrets your slice needs.

## How we work

Two-week sprints, one report to the lecturer at the end of each. CI, CD and
security testing run on every pull request from Sprint 1. A pull request needs its
slice owner's review (`CODEOWNERS`) and a green `npm run verify`.
