# Load test with the real model, 21 October 2026

Target: the public HTTPS address. The workers ran in steering mode with
gpt-4.1-nano (pinned in the deploy workflow), not in demo mode. Recorded with
asciinema while it ran: `docs/platform/slides/out/casts/load.cast`,
`scale.cast` and `workers.cast`.

## k6, PROFILE=short

```
questions 131, at rest 130, waiting over cap 0, timed out 0
time_to_rest median 4.1 s, p95 27.0 s, max 46.0 s
http requests 1159, failed 0.00 %
```

One question was not yet at rest when the profile ended.

## KEDA's autoscaler (`kubectl get hpa keda-hpa-worker --watch`)

Seconds from the start of the watch, jobs per worker against the target of 5,
and the replicas:

| s | jobs per worker / target | workers |
|---|---|---|
| 3 | 0/5 | 1 |
| 52 | 4/5 | 1 |
| 67 | 10/5 | 1 |
| 82 | 4/5 | 2 |
| 97 | 4.5/5 | 2 |
| 112 | 5/5 | 2 |
| 142 | 4/5 | 2 |
| 172 | 0/5 | 2 |
| 217 | 0/5 | 1 |

With the real model a worker spends most of a turn waiting for the model, so
the queue grew less than in the demo-mode run of 20 October (1 to 4 workers).
KEDA added one worker when the jobs per worker passed the target, and removed
it after the queue had been empty for its cooldown.
