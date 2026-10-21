# Icons and business motion: the "story" group

Files changed: `scenes_story.py` (tree, platform, contexts, plus three shared helpers) and
`scenes_lean.py` (derive only). `problem()`, `keys()`, `schema()` and `milestones()` are not
changed. No icon was added to `icons.py`: the existing kinds cover every part.

New helpers in `scenes_story.py`:

- `fly(sc, seconds, items, each=None)` moves business objects (icons) along their connectors,
  eased, with staggered starts. `each()` runs once a frame, so a gear turns while work moves.
- `busy(sc, seconds, each)` makes frames where only a gear turns (12.5 frames a second).
- `draw_flying(c, st)` draws the moving objects last and lit. A turn in a queue keeps its
  square and a recorded step keeps its bar; everything else is its icon.

## tree (24.0 s, 207 frames)

Parts: a person icon ("you"), the lead and three readers as halftone spheres, and a wallet
icon with the cost under it ("of a $1.00 cap"). A rail runs from the lead and from the readers
to the wallet. The question text stays as one 14 pt caption over the line from you to the lead.

1. You ask a question: a question bubble travels from you to the lead. The lead lights.
2. A lead agent plans the work: a coin travels from the lead along the rail into the wallet. $0.01.
3. Three readers work in parallel: three small papers go out from the lead to the readers.
   The lead shows "lead: waiting".
4. Every step is recorded with its cost: three rounds of three coins travel from the readers
   into the wallet. $0.02 after the second round.
5. Three findings and one answer come back: three finding papers travel back to the lead and
   stack under it. $0.03. Then an answer paper travels from the lead back to you, with the
   inverted block "answer, with 3 findings".

The findings now go back to the lead (the real task tree), not to a findings column.

## platform (17.9 s, 148 frames)

Parts: a person ("agent author") under "producers"; a thin frame named "platform" that holds
the registry icon ("agent registry", with `literature-scout` over it once published), the gear
("run engine"), the stream icon ("steps"), the wallet ("billing", then "USD 0.01") and the key
icon ("API key") where the app enters; under "consumers" a browser ("web app") and an app
icon ("literature watch").

1. A producer publishes an agent: a paper travels from the author into the registry.
2. A consumer app gets an API key and picks an agent: a question bubble travels from the app
   to the key. The key and the agent's name light.
3. The platform runs it, records each step and bills it: the question goes on to the gear and
   the agent's paper drops from the registry into it. The gear turns. Three step bars travel to
   "steps", then a coin travels to the wallet (USD 0.01). An answer paper travels back to the
   app, which gets a check mark.
4. The app only asks; the platform does the rest: inverted "about 210 lines" under the app,
   and "no database · no model · no billing" under that.

## contexts (27.2 s, 147 frames)

Parts: five icons with their names: Projects (folder), Session (stream), Execution (gear),
Identity (key), Billing (wallet). The boxes, the aggregate lines and the legend are gone.
Each domain event is an arrow, and its name appears when it happens.

1. The platform splits into five bounded contexts.
2. question asked: a question bubble, Projects to Session.
3. turn queued: a square (a turn in a queue), Session to Execution. The gear turns from here.
4. step recorded: a step bar, Execution to Session. The gear turns while it travels.
5. spend recorded: a coin, Session down to Billing.
6. over cap: approval needed: a lock, Billing up to Session.
7. finding recorded: a paper, Session to Projects.
8. One question: six events across five contexts: all six names stay, in grey.

## derive (14.2 s, 40 frames)

Steps 1 to 4 are as before: the scattered words group into five columns, each column gets its
frame and context name, then its aggregate (inverted; "no state" for Execution). Step 5 now
ends with each context's icon (key, folder, stream, gear, wallet) under a short arrow from its
frame, and the service name in mono under the icon: identity, project, session, worker, billing.

## Other changes and open points

- The module docstring of `scenes_story.py` said "demo-mode run". It now says "recorded run".
- All labels are 14 pt or larger. Every loop starts and ends on a calm held frame.
- The approval event uses the lock icon. No icon says "approval" better without a new one.
- Nothing was committed and `build.js` was not run.
