# Logging

One logger for the process, in `apps/server/src/core/log/`. Fastify's request
lines and every slice's lines go through it, in the same format, at the same
level. `console.*` is a lint error in `apps/server/src`.

## Where a slice gets its logger

- A slice that is composed in `app.ts` receives `log` in its deps and keeps
  `log.child({ slice: '<name>' })`.
- A worker receives `report.log` on its `WorkerReport`. Its lines already carry
  `sessionId`, `taskId` and `accountId`. Do not add them again.
- A model call is logged by wrapping the provider: `withLog(model, report.log)`
  from `core/model`. The line carries provider, model, tokens, cost, duration
  and stop reason, or the `ModelError` kind when it failed.

## What the kernel logs

- `task started`, `task ended` (with `status` and `durationMs`), `task failed`
  (with `err`), `task refused by the budget`, `fan-out refused`.

## Levels

- `error`: a run or a request failed and somebody has to look.
- `warn`: refused, dropped or retried; the process carries on.
- `info`: one line per thing that happened: a task, a model call, a command.
- `debug`: only for a session you are looking at now.

`LUMEN_LOG_LEVEL` sets the level. On a terminal outside production the lines
are pretty-printed; on a host they are JSON, one line each.

## Never in a line

API keys, cookies, tokens, passwords, the text of a prompt or an answer, the
contents of a file. The keys `apiKey`, `authorization`, `cookie`, `password`,
`secret` and `token` are written as `[redacted]` at the top of a line and one
level down (`core/log/log.test.ts` proves it). Do not put a secret under
another name.

## Reading one run

Every line of a run carries its `sessionId`:

```bash
flyctl logs --app lumen-next-staging --no-tail | grep '"sessionId":"<id>"'
```
