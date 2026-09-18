# Project card State story

## Before: repeated status checks

A brute-force card checks session status to choose a label, checks it again to
offer Stop, and repeats the check in the list poller. Running and waiting cards
can then disagree about whether work is active. A new terminal status can stop
showing Stop while accidentally continuing to poll.

```text
render: running -> Running; waiting -> Waiting for you; ended -> Finished; ...
actions: queued/running/waiting -> Open session + Stop; otherwise Open session
poll: queued/running/waiting -> continue; otherwise stop
```

## After: one state, one descriptor

`ProjectCardContext` selects one of six `ProjectCardState` implementations with
an exhaustive mapping of the shared `TaskStatus`. Each implementation supplies
the label, semantic tone, actions, and refresh policy together. Consumers use
the resulting descriptor instead of separately interpreting session status.

The context copies the status from a confirmed summary. `applySummary` accepts
any authoritative snapshot, including skipped transitions or a different latest
session. It projects session state; it does not enforce session transitions.
Stop requests and refresh errors do not supply a confirmed summary, so neither
updates the context. Terminal states retain Open session, including access to
findings there. The classes perform no IO and start no timers.

`ConfirmedSessionSummary` is an internal status-only projection. The current
shared `Session` has no status field; this type neither changes that contract
nor pretends to implement the planned session summary API. State classes and
the context remain internal to projects and are not public-index exports.

## Validation and remaining integration

Tests exercise each concrete state, coherent descriptor changes across confirmed
updates, direct terminal snapshots, repeated snapshots, and retention of the
last confirmed state until another summary arrives.

The UC2 service now selects the latest confirmed session and passes it into the
context. HTTP cards contain the resulting label, tone, actions and polling
policy. Home consumes these values without importing server classes. Its
refresh scheduler stops periodic reads for terminal cards, retains the last
confirmed card on transient failures and refreshes after Stop acknowledgement.
Ownership comes from the unchanged shared auth guard.

The pattern tests preceded the pattern implementation in commits `cfe6e2a` and
`e538228`. Service, HTTP, store and real-kernel integration tests extend those
tests. Shared startup/session/client changes remain unapplied owner patches;
see [the handoff](integration/README.md). No pattern class owns execution or
changes session state in response to a click.
