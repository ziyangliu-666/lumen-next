<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo-dark.png">
    <img alt="lumen" src="apps/web/public/logo-light.png" width="420">
  </picture>
</div>

# lumen

An AI that does research in mathematics on its own, and lets you watch and
steer it while it works.

Ask a question. A lead agent plans the work and hands parts of it to readers that
run in parallel: they search the literature, run computations in a sandbox and
record what they find. The answer arrives with its evidence.

## Features

- **Parallel agents.** A lead splits the work into readers; the call tree, every
  step and its cost stream to the browser as they happen.
- **Literature search.** arXiv, OpenAlex and the OEIS, with links to every source.
- **Real computation.** Python (NumPy, SymPy, NetworkX, Matplotlib) in a Docker
  sandbox with no network; files the agents keep stay with the project.
- **Steer, stop, edit.** Message a running task, stop it, or edit your last
  message and run it again.
- **Your models.** Any OpenAI-compatible API (OpenAI, DeepSeek and others); pick
  the model per turn, or bring your own key.
- **Accounts and spend.** GitHub, Google or email sign-in; a spend cap with
  approvals; Stripe top-ups.

## Quick start

Requires Node.js 22 or later.

```bash
npm install
npm run build
node apps/server/dist/main.js
```

Open <http://localhost:4000>. With no database and no model key, lumen keeps
everything in memory and runs a demo agent, enough to explore the interface.

To run the real agents, set a model key and the steering worker:

```bash
OPENAI_API_KEY=sk-... LUMEN_MODEL_PROVIDER=openai LUMEN_WORKER=steering \
LUMEN_COMPUTE_PROVIDER=docker node apps/server/dist/main.js
```

## Development

Requires Node.js 22 or later and Docker.

```bash
cp .env.example .env
docker compose up -d db                  # PostgreSQL on :5432
npm run dev --workspace @lumen/server    # API and WebSocket on :4000
npm run dev --workspace @lumen/web       # web app on :4173
npm run verify                           # format, lint, typecheck, tests
```

Every setting is documented in [`.env.example`](.env.example). Sign-in with
GitHub or Google: [docs/oauth.md](docs/oauth.md). Email: [docs/mail.md](docs/mail.md).

## Architecture

One Node.js process (Fastify) serves the API, a WebSocket event stream and the
React app; PostgreSQL keeps the record, or memory when `DATABASE_URL` is unset.

```
apps/server     core (events, database, HTTP) and one module per slice:
                identity, projects, session, steering, billing
apps/web        React 19, Vite, Tailwind CSS, shadcn/ui
packages/contracts   types and events shared by server and web
deploy          the container entrypoint and the sandbox's Python packages
```

A module uses another only through its public index (`modules/<name>`).

## Contributing

Issues and pull requests are welcome. Make `npm run verify` pass, and use
[Conventional Commits](https://www.conventionalcommits.org). To report a
security issue, see [SECURITY.md](SECURITY.md).
