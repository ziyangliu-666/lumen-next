<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo-dark.png">
    <img alt="lumen" src="apps/web/public/logo-light.png" width="480">
  </picture>
</div>

<br>

[中文](README.md) · **English**

An automated research system: give it a research question, and several AI agents
split the work between them, looking things up and running computations. The whole
process is laid out live as a call tree, and you can open any part of it at any time
to look inside, interject, or change direction. SWE5006 practice module, Team 1.

## Architecture

The backend is a monolith: one process, one Postgres database, and modules that call
each other directly in-process — no network hops, no microservices. The frontend is a
React single-page app.

The code is split vertically by feature. Each person owns one module, from its page
all the way to the backend, instead of splitting into a frontend team and a backend
team.

```
packages/contracts   Event protocol and data types shared by frontend and backend (locked after the first sprint)
apps/server          The backend monolith
  src/core           Domain model, event broadcast, database, HTTP — the shared part, frozen after Sprint 1
  src/modules        One directory per module, each with one owner
apps/web             The React frontend, one directory per page
```

## Who owns what

![lumen ownership and modules](docs/slices.svg)

- Interface design (every screen is marked with its owner): [live at ziy.bio/lumen-next](https://ziy.bio/lumen-next/) · [source: docs/spec/index.html](docs/spec/index.html)
- How to work alongside agents (read this first if you are new): [docs/ONBOARDING.md](docs/ONBOARDING.md)
- System architecture, the shared types and interfaces, and what each module offers the others: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- The exact boundaries of each module: [docs/SLICES.md](docs/SLICES.md)
- What counts as done: [docs/DOD.md](docs/DOD.md)
- Coding standards: [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
- The frontend has one look: [docs/UI.md](docs/UI.md)
- Which directory belongs to whom: [CODEOWNERS](CODEOWNERS)

## Running it locally

```bash
npm install
docker compose up -d db          # start a local Postgres
npm run verify                   # one command for all of it: formatting, lint, type check, tests, coverage
npm run dev --workspace @lumen/server
npm run dev --workspace @lumen/web
```

Requires Node 22 or later. Copy `.env.example` to `.env` and fill in the keys your
module needs.

## Staging

<https://lumen-next-staging.fly.dev>. On every merge to main, the Deploy workflow runs DAST and
then deploys the same image to Fly.io. The configuration is in `fly.toml` and `deploy/fly/`.

## How we work together

Sprints are two weeks long, and each ends with a progress report. From the first sprint
on, every PR runs CI, CD and security scans automatically. To merge into the main
branch, code must pass review by the relevant owner and have CI fully green.
