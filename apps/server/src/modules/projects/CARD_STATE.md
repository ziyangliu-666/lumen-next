# Project card State story

## Before: repeated status checks

A brute-force card checks status for a label, the service checks it again before
calling Stop, and the poller repeats it when choosing a refresh interval.
A new terminal status can hide Stop while still dispatching it or polling forever.

```text
render: running -> Running; waiting -> Waiting for you; ended -> Finished; ...
stop: queued/running/waiting -> send command; terminal -> refuse
poll: queued/running -> 5 seconds; waiting -> 15 seconds; terminal -> none
```

The first refactor returned a descriptor from each class. That removed repeated
presentation checks but was equivalent to a configuration table; review S1
correctly identified that it did not demonstrate behavioral State delegation.

## After: states own commands and refresh behavior

`ProjectCardContext` selects one of six `ProjectCardState` implementations using
an exhaustive mapping of the shared `TaskStatus`. It delegates `describe()`,
`stop(command)` and `pollDelay()` to the current state.

Queued, Running and Waiting execute the injected Stop command and acknowledge
only after success. A rejected command propagates without changing the confirmed
state. Finished, Stopped and Failed return `already_terminal` without invoking
the command. Waiting polls at 15 seconds, Queued/Running at 5 seconds, and
terminal states return no interval. The service delegates Stop to the context
and publishes its interval as `pollAfterMs`; Home consumes it directly.

This places the decision to execute or refuse an action in the current state,
not in a service conditional. A descriptor table alone cannot execute that
protocol; it would need a separate dispatcher implementing the same rules.
A table plus callbacks remains a valid simpler alternative if the behavior does
not grow; the chosen classes keep each state's presentation and behavior together.

`applySummary` asks the current state whether a transition is legal before
replacing it. Queued accepts the first observation and skipped forward states.
Once a card has left Queued, it refuses a transition back to Queued and preserves
its current descriptor. Repeated snapshots are idempotent. New research turns
may resume an existing root, including after completion, so other observed
statuses remain legal. A different session is initialized with a new context.
These are card projection rules; projects does not change session's execution
lifecycle. Stop acknowledgement alone still does not update confirmed state.

## Validation

Behavior tests were run failing before implementation. They exercise command
execution in each active state, refusal in each terminal state, rejected commands,
different intervals, context delegation after a confirmed summary replacement, and refusal of illegal
transitions without mutating the previous state.
Service tests verify these behaviors are used in production orchestration.
The original descriptor tests remain as regression checks, and integration tests
use session's real public directory. See [integration](integration/README.md).
