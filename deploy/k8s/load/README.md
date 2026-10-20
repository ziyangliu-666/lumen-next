# Load test: many questions at once

`ask.js` is a k6 script. Many users ask questions at the same time. The turns
wait on the queues `lumen.turns.0`, `lumen.turns.1` and `lumen.turns.2`, and
KEDA scales the `worker` deployment on their length.

## What one iteration does

1. `setup()` signs up a pool of accounts (`POST /api/auth/signup`) and keeps
   their `lumen_session` cookies. The password is random and never printed.
2. Each virtual user (VU) takes one account from the pool. It signs in again
   (`POST /api/auth/password`) only after a `401`.
3. The VU creates a project with a short question (`POST /api/projects`).
   This opens the first session.
4. The VU reads the session (`GET /api/sessions/:id`) every second until its
   root task is at rest: `ended`, `stopped`, `failed` or `waiting`. The time
   from the project to rest goes to the Trend `time_to_rest`.

The test fails when more than 1 % of the HTTP requests fail.

## Cost

Run the test only against workers in demo mode. The demo worker calls no
model, so the test costs no money. The chart picks steering when a model key
is set, so force demo mode first:

```sh
helm upgrade lumen deploy/k8s/lumen -n lumen --reuse-values --set-string config.worker=demo
```

On the public host, run the `Platform deploy` workflow by hand with
`worker: demo`.

Each demo question records USD 0.03, and each account has a USD 1 cap. Thus
one account holds about 33 questions. The pool (`POOL`, default 60) is larger
than the VU count for this reason. A root task in `waiting` means an account
reached its cap: the pool was too small. The summary counts these apart.

## Run it

Against local k3d (the chart's default host):

```sh
k6 run -e LUMEN_URL=http://lumen.localhost deploy/k8s/load/ask.js
```

Against the public host:

```sh
k6 run -e LUMEN_URL=https://lumen.<ip-with-dashes>.sslip.io deploy/k8s/load/ask.js
```

`LUMEN_URL` must be the same origin as the server's `LUMEN_ORIGIN`, with no
trailing slash. The identity slice refuses a write from any other origin.

| Variable | Default | Meaning |
|---|---|---|
| `LUMEN_URL` | none | The origin to test. Required. |
| `PROFILE` | `full` | `full`: 1 to 30 VUs over 2 min, hold 3 min, down over 1 min. `short`: 1 to 10 VUs over 30 s, hold 1 min, down over 20 s. `smoke`: 2 VUs for 30 s. `demo.sh` uses `short`; the deploy pipeline runs `smoke` after each deploy. |
| `POOL` | `60` | The number of accounts that `setup()` creates. |
| `SUMMARY` | `summary.json` | The file for the JSON summary. |

## What to watch at the same time

In a second terminal:

```sh
kubectl get scaledobject,hpa,pods -n lumen -w
```

On the public host, run the same command through SSH:

```sh
ssh -i <key> ubuntu@<ip> sudo k3s kubectl get scaledobject,hpa,pods -n lumen -w
```

The worker goes from 1 replica to at most 4 while the queues are long. It
goes back to 1 after the KEDA cooldown. To see the queues:

```sh
kubectl exec -n lumen rabbitmq-0 -- rabbitmqctl list_queues name messages messages_unacknowledged consumers
```
