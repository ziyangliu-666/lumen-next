# lumen

A web page where agents delegate to each other, and the call tree is something you can
stand inside rather than read afterwards.

Built on [pi](https://github.com/earendil-works/pi). pi runs one agent; this adds the part
where several of them work together and you can walk into any of them.

## The one rule

> **A point is the lifetime of one context window.**

Every event that opens a window opens a point on the graph. Nothing else does.

| what happens | new point? |
|---|---|
| you start a conversation | yes |
| an agent delegates | yes — an empty window, seeded with the task |
| an agent starts a line that never returns | yes |
| the window fills up and is compacted | yes — reseeded from the summary |
| you keep typing at a point | no |
| the agent's own think-act loop | no (that grows its steps) |

Two things follow from the rule rather than being decided:

- **Old points are read-only by physics.** After compaction the earlier window no longer
  exists, so nothing can be sent to it. Only the newest point on each line is live.
- **A summary can cross agents; verbatim history cannot.** History is full of tool calls
  naming the previous agent's tools. That is why handing work over goes through the
  summariser.

## Four kinds of edge

The renderer reads the edge type and never guesses from shape — a tool call that spawned
one child and a compaction both draw as one point leading to one point, and they mean
opposite things.

```
lead
├─ worker              delegate  work sent out; the answer comes back here
├╌▸ worker             branch    started here and gone; nothing waits for it
╌╌ lead                compact   the machine ran out of room; no intent in it
── reviewer            handoff   someone decided the work should change hands
```

The difference between the first two is one fact: **is anyone waiting for the answer?**
Everything else follows — whether it returns, whether stopping the parent stops it, and
whether its failure has any channel other than the graph.

Cost obeys the same rule. A point's total is its own spend plus the work it **delegated**.
Branches and compacted successors are their own points with their own numbers.

## Leaving it running

There is a switch in the header. While it is on, every turn the lead ends is continued
automatically: it delegates, reads what came back, decides what is still missing, and
delegates again. You state the question once instead of once per round.

It adds nothing to the graph. Each automatic turn is an ordinary turn on the lead's own
line, so a long run fills its window, compacts, and draws itself as a chain of lead points
running to the right with its delegations hanging underneath.

Three things end a run, and they read differently on purpose:

| | |
|---|---|
| the lead calls `finish` | the work is done. It says why, in its own words |
| the budget runs out | the money is gone. It gets one last turn, which can write but not spend |
| you press stop, or the switch | a decision |

**The budget is the only number.** `LUMEN_AUTO_BUDGET`, $2 by default, and changeable
while a run is going from the settings panel — raising it after a run stopped on its budget
lets it carry on rather than start the question again. Not a turn cap:
turns differ in cost by two orders of magnitude between a one-line answer and a fan-out of
twelve workers, so a turn limit either cuts cheap work short or waves an expensive run
through. The cap is checked in three places, because one turn can spend a lot between two
checks — the driver checks between turns, the delegation tool checks when a fan-out
arrives, and each window is checked as it opens. Work already in flight when the cap trips
still finishes, so a run can overshoot by up to one round of concurrent windows per waiting
call.

Workers delegate too, so the tree is as deep as the question needs. The lead is the one
agent kept off the menu they read: a worker that delegated to a lead would open a second
conversation with a person who is not there.

## What you can do

Three actions. Everything else the system does on its own; these are takeovers.

1. **Type.** The only question is how much history goes with it:

   | target | new point? | what it sees | can swap agent? |
   |---|---|---|---|
   | talk to X | no | the window it already has | no |
   | talk to X while it works | no | the same, from inside the turn | no |
   | start the next window | yes | a summary focused by what you just said | no |
   | hand over to X | yes | the same summary | yes |
   | send X off | yes | **only your sentence** | yes |

   Typing at a point that is working is the second row. Your sentence joins the turn
   already running rather than starting one, and you choose when it lands: at the end of
   this turn, or at the model's next step. Neither is an abort — the workers that were
   already going keep going, which is why cutting in is cheaper than stopping.

   `@n-4` in your message pastes in what that point currently says. Referencing several
   points is all "merging" is: a fresh empty window fed several summaries.

2. **Click a point** to move there. Live points take input; ended ones explain why not and
   offer the way forward.

3. **Stop.** It also turns the switch off, because a stop that left the driver running
   would start the work again a second later.

## Settings

The `settings` link in the header opens a panel. What it changes lasts as long as the
conversation and is saved nowhere; the environment variables below are what every new
conversation starts from.

| | changeable | when it takes effect |
|---|---|---|
| budget | yes | at once, including a run already going |
| model | yes | the next window that opens |
| keep-recent tokens | yes | the next window that opens |
| delegation depth | yes | work started from now on |
| how many at once | yes | the next delegation call |
| working directory | **no** | |
| extensions | **no** | |

The panel is also the way back to an empty page. **new conversation** closes this one — the
driver stops, its windows end, and the server forgets it — then reloads. Nothing is saved
anywhere, so there is no other way, and no way back to what you closed.

The model and the thresholds cannot claim more than "the next window": pi binds both when a
session is built, and rebuilding one to change them would throw away the window, which is
the conversation.

The last two are absent on purpose rather than unimplemented. Extensions execute arbitrary
code with your permissions, so a page that could add one is a page that can install a tool
into an agent, and the working directory is the boundary of what the agents can read. Both
stay on the command line, and the panel shows their values so nobody has to guess.

## Running it

Needs Node 22+ and model credentials in `~/.pi/agent/auth.json`.

```bash
npm install
cd packages/web && npx vite build && cd ../..
node --experimental-strip-types packages/server/src/index.ts
# http://127.0.0.1:4173
```

For the frontend with hot reload, run `npx vite` in `packages/web` and use the port it
prints; it proxies the socket to the server.

| variable | default | what for |
|---|---|---|
| `LUMEN_PROVIDER` / `LUMEN_MODEL` | `deepseek` / `deepseek-v4-pro` | which model |
| `LUMEN_PORT` | `4173` | |
| `LUMEN_CWD` | current directory | what the agents can read |
| `LUMEN_AUTO_BUDGET` | `2` | dollars one run may spend while it runs itself |
| `LUMEN_MAX_DEPTH` | `3` | how deep delegation may go |
| `LUMEN_MAX_CONCURRENT` | `4` | how many children one call runs at once |
| `LUMEN_KEEP_RECENT_TOKENS` | pi's default (20k) | set to a few hundred to watch a line compact without holding a long conversation first |
| `LUMEN_EXTENSIONS` | `node_modules/pi-web-access` | pi extensions to load by path; set empty to run without the web tools |

## Security

**Loopback only, one person, one machine. That is the whole model.**

The agents run bash-free but with your file permissions, `pi-web-access` reaches the
internet, and pi packages execute arbitrary code. There is no sandbox: `Runtime` runs
subagents in-process precisely so their events arrive directly, and the isolation that
needs is a container around the whole run, which does not exist yet. Do not put this behind
a tunnel.

Two properties do hold:

- **Agents cannot gain a tool from what they read.** Extension auto-discovery is off; only
  extensions named in code are loaded, so a repository cannot introduce one.
- **The tool allowlist is enforced by the process, not asked for in a prompt.** An agent
  without `write` cannot write whatever it is talked into.

The second one was broken until recently: `tools: []` compiled to "drop the built-ins",
which leaves every extension-registered tool standing. An agent declared as having no tools
fetched two web pages. If you add tools, check the allowlist still means what it says.

## Layout

```
packages/kernel   the engine. Line, Trace, the subagent and finish tools, the driver.
                  No web, no server.
packages/server   one process: HTTP + WebSocket, and the agent definitions.
packages/web      React + Vite. One reducer over the trace events.
```

`TraceEvent` is the wire format — the events the kernel already emits go to the browser
unchanged. There is no second vocabulary to keep in step.

## Tests

```bash
npx vitest --run                                # kernel
npx tsc --noEmit                                # kernel + server
npx tsc --noEmit -p packages/web/tsconfig.json  # web
```

The kernel tests use a fake session that emits pi's own event shapes, so they pin the
things that must be right before any model runs: that the picture matches what the machine
did, and that the money adds up once.
