# A worker pod deleted during a question, 20 October 2026

Target: the public host, one worker pod, workers in demo mode. Each question
was asked through `POST /api/v1/questions`, and the pod was deleted 1 to 2
seconds later, while the question ran.

## Graceful delete (`kubectl delete pod`)

- Deleted at 15:05:08 UTC. Kubernetes sent SIGTERM.
- The pod stopped taking new turns and finished the turns in hand, as the
  worker's shutdown order says. A new pod started at once.
- The question ended at 15:05:09: status `ended`, cost USD 0.03, 3 findings.
  This is the same result as an undisturbed question.

## Hard kill (`kubectl delete pod --grace-period=0 --force`)

- Deleted at 15:05:41 UTC, with turns in hand (queues 2 s later: depth 0 one
  message, depth 1 two messages, all unacknowledged and held by the new pod).
- The unacknowledged turns went back on their queues, and the new pod took
  them.
- The question ended at 15:05:51: status `ended`, 12.6 s after it started.
- Cost USD 0.08 and 8 findings, against USD 0.03 and 3 findings for an
  undisturbed question. The turns that were redelivered ran again from their
  start, and their first steps stayed recorded. This is the known limitation
  "a redelivered turn runs again from its start" (report, AISS table).
