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
| the machine | **no** | |

The panel is also the way back to an empty page. **new conversation** closes this one — the
driver stops, its windows end, and the server forgets it — then reloads. Nothing is saved
anywhere, so there is no other way, and no way back to what you closed.

The model and the thresholds cannot claim more than "the next window": pi binds both when a
session is built, and rebuilding one to change them would throw away the window, which is
the conversation.

The last three are absent on purpose rather than unimplemented. Extensions execute arbitrary
code with your permissions, so a page that could add one is a page that can install a tool
into an agent; the working directory is the boundary of what the agents can read; and the
machine is where code an agent wrote gets executed. All three stay on the command line, and
the panel shows their values so nobody has to guess.

## Running it

Needs Node 22+ and model credentials in `~/.pi/agent/auth.json`. For `run`, Modal
credentials in `~/.modal.toml`, which `modal setup` writes. Without them a conversation
still works: the first command an agent tries comes back as a failure it can read, and the
run carries on as the reading system it was before.

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
| `LUMEN_PROVIDER` / `LUMEN_MODEL` | `deepseek` / `deepseek-v4-flash` | which model a new conversation starts on; changeable per conversation in the panel |
| `LUMEN_PORT` | `4173` | |
| `LUMEN_HOST` | `127.0.0.1` | move it off loopback and the server refuses to start unless `LUMEN_BASIC_AUTH` is set |
| `LUMEN_BASIC_AUTH` | none | `user:password`; required once `LUMEN_HOST` is not loopback, ignored otherwise |
| `LUMEN_SESSIONS` | `~/.lumen/sessions` | where each conversation's own directory is made |
| `LUMEN_STATE` | `~/.lumen/state` | where each conversation's durable record — its trace, its findings, what was typed — is written |
| `LUMEN_MATERIAL` | none | a folder for the agents to study, if every conversation on this server is about the same one |
| `LUMEN_AUTO_BUDGET` | `2` | dollars one run may spend while it runs itself |
| `LUMEN_MAX_DEPTH` | `3` | how deep delegation may go |
| `LUMEN_MAX_CONCURRENT` | `4` | how many children one call runs at once |
| `LUMEN_KEEP_RECENT_TOKENS` | pi's default (20k) | set to a few hundred to watch a line compact without holding a long conversation first |
| `LUMEN_EXTENSIONS` | `node_modules/pi-web-access` | pi extensions to load by path; set empty to run without the web tools |
| `LUMEN_COMPUTE` | `modal` | where `run` sends commands; set empty and agents cannot run anything |

`pi-web-access` runs with no search provider configured out of the box, and falls back to
whichever one it can reach with nothing set up. Bring your own by setting the matching
environment variable before starting lumen — `pi-web-access` reads it directly, nothing in
lumen has to know about it: `TAVILY_API_KEY`, `BRAVE_API_KEY`, `EXA_API_KEY`,
`OPENAI_API_KEY` (for its search mode), `PERPLEXITY_API_KEY`, `JINA_API_KEY`, `KAGI_API_KEY`,
and others — one file per provider under `node_modules/pi-web-access/`, each named for the
variable it reads, is the source of truth for exactly which one and what it is called.
`pi-web-access` also accepts a `~/.pi/agent/web-search.json` file for the same keys, and for
providers a bare environment variable does not cover (`brightdataApiKey`, `serpbaseApiKey`,
and a few more) — that file is the only way to set those.

## Where a conversation lives

Every conversation gets a directory of its own, made when it starts and named after it,
under `~/.lumen/sessions`. It is the agents' working directory, it is where anything they
save lands, and it is how one agent leaves something for another to read. It starts empty
and nothing ever cleans it up.

That is a change, and it came from a run that went wrong. The agents used to work in
whatever directory the server was started from, which was almost always this repository. A
question about a mathematical conjecture therefore arrived with a code search tool in the
agents' hands and lumen's own source underneath it, and a worker duly grepped the repository
and reported a test file as a finding.

So a conversation is about nothing on your disk until you say otherwise. **material** in the
settings panel points it at a folder to study; leave it empty and the agents know about
nothing but their own directory.

| | |
|---|---|
| the conversation's directory | theirs, writable through `save`, empty at the start |
| material | yours, something they were asked to read, and told not to change |

**`save` is lumen's own tool, and that is the reason it exists.** pi's `write` resolves an
absolute path anywhere on the disk, so an agent given it in a session directory is not
confined to that directory at all — the boundary would live in a sentence in a prompt, which
is the one thing this project says not to rely on. `save` resolves paths itself, against the
conversation's directory, and refuses anything that climbs out.

## Killing the server does not lose the run

A conversation's trace, its findings graph, and what you typed are written to
`~/.lumen/state` — a separate tree from `~/.lumen/sessions`, on purpose: `save` is rooted at
the conversation's own directory under `sessions`, so an agent's own tool call could never be
made to overwrite lumen's record of it if the two lived in the same place. The write is
debounced (a couple of seconds behind whatever just happened) and unconditional on a clean
shutdown, so restarting the server and reconnecting with the same key brings the conversation
back — read only. Every agent's actual context window is `pi`'s, held only in this process's
memory, and it does not come back; a node still `running` when the process ended is shown
stopped, honestly, rather than with a spinner nothing will ever clear. The conversation's own
directory under `sessions` is untouched by any of this, so the files it produced are still
there and still linked from the points that made them.

The same is not true in the other direction, and it is worth saying plainly: pi's `read`,
`grep`, `find` and `ls` resolve absolute paths too. **material is a default and a statement
of intent, not a fence.** An agent that decides to read somewhere else can.

## The machine

An agent can run commands. `run` sends one to a Linux container that belongs to a compute
provider — Modal today — and hands back what it printed and what it exited with.

```
worker
├─ run   $ git clone https://github.com/…
├─ run   $ pip install -r requirements.txt
└─ run   $ pytest -q
```

**This is not `bash`, and the difference is the whole reason it exists.** pi ships a `bash`
tool. It runs here, with your permissions, on your disk, with unfiltered outbound access,
and nothing in this project has ever handed it to an agent. `run` executes somewhere else,
on a container that cannot see this machine and is destroyed with the conversation. What
made execution unsafe to give out was where it ran, so that is what moved.

The two names must also stay apart mechanically. `toolSelection` merges custom tool names
into the same allowlist pi reads, so a custom tool named `bash` would put the string
"bash" into that list — and that string is what switches pi's own local shell back on,
under a name that looks like ours. `save` carries the same warning about `write`.

| | |
|---|---|
| the machine | a container elsewhere, `/work`, empty, network, shared by every agent on the run |
| the conversation's directory | on your disk, where `save` writes, what `read` sees |

**The two do not share a filesystem, but one narrow tool crosses between them.** An agent
that wants text to survive prints it and `save`s it, the same as always. For anything else —
a plot, a checkpoint, a generated document — `collect` copies exactly one named file from the
machine into the conversation's own directory, and nothing wider than that: no listing the
machine's disk from here, no wildcard, no directory copy. It needs both `run` and `save`
already, since it has nothing to collect without the first and nowhere to put it without the
second, so it costs no permission of its own.

One machine per conversation, not one per agent. It is the same reason the conversation has
one directory: one worker clones the repository and a second runs the tests against that
checkout, and agents with a machine each would both start from an empty disk.

It starts on the first command and not before, so a conversation that never runs anything is
billed for no machine. It is 2 cores and 4 GiB, with no GPU and no way to ask for one.
Choosing hardware is meant to be the system's job; a menu of GPU sizes would be the thing
this is trying to remove, and reading a repository well enough to size it is not written yet.

Two limits are constants rather than settings, because money is the one quantity you bound
here and the budget already bounds it: a machine lives at most an hour, and dies after ten
idle minutes. A command gets ten minutes unless the agent asks for more, up to forty-five.
When a machine has died, the next command opens another and its result says so in the first
line — a worker that has just lost its checkout has to be told, not left to conclude the
repository was never cloned.

### What it costs

**Compute goes into the same total as tokens.** A machine is billed for every second it is
up, including the minutes a model spends deciding what to run next, and those dollars are
charged to the window that ran the command through the same call model spend arrives on. So
the budget covers compute without the driver learning a second number, and a point's figure
in the panel is what that window really cost.

It is an estimate of list price. lumen multiplies seconds by Modal's published Sandbox rates
(read 2026-08-24: $0.00003942 per core-second, $0.00000667 per GiB-second — note those are
the Sandbox rates, three times the standard ones printed higher on the same page). Free
credits, committed spend and plan allowances all move the real figure and none of them are
visible from here. Modal's own dashboard is the invoice.

One case is under-counted: the last machine of a conversation nobody comes back to. It idles
for up to ten minutes and dies, and if no further command runs, those minutes reach no
window. That is about nine cents.

## Security

**Loopback only, one person, one machine, by default. That is the whole model, until you
move `LUMEN_HOST`.**

Setting `LUMEN_HOST` to anything but loopback moves the boundary from "only this machine
can reach the port" to "only someone with the password can". `LUMEN_BASIC_AUTH` is that
password, as `user:password`; the server refuses to start on a non-loopback host without
one, because a public bind with nothing guarding it is not a smaller version of this model,
it is the absence of one. Basic Auth is plain text on the wire unless something in front of
this terminates TLS — a domain and a certificate, which lumen does not set up for you.

The agents run with your file permissions, `pi-web-access` reaches the internet, and pi
packages execute arbitrary code. There is no sandbox around lumen itself: `Runtime` runs
subagents in-process precisely so their events arrive directly, and the isolation that
needs is a container around the whole run, which does not exist yet. Do not put this behind
a tunnel.

`run` does not change that, in either direction. The code an agent runs is isolated from
this machine, because it is on somebody else's; the process that decides what to run is
not isolated from anything. An agent that reads a hostile repository and then runs what it
suggests harms a container you are paying for, and can still spend your money and reach the
internet from it. The container has no outbound restrictions: `pip` and `git` need the
network, and an allowlist that covers those covers most of what an attacker wants too.

Two properties do hold:

- **Agents cannot gain a tool from what they read.** Extension auto-discovery is off; only
  extensions named in code are loaded, so a repository cannot introduce one.
- **The tool allowlist is enforced by the process, not asked for in a prompt.** An agent
  without a tool cannot use it whatever it is talked into.
- **What an agent writes, it writes inside its own conversation's directory.** `save` does
  its own path resolution and refuses to climb out. This is the one path boundary here that
  is real; reading has none.
- **What an agent runs, it runs somewhere else.** `run` reaches a provider's container and
  has no route to this filesystem. It is never named `bash`, and the reason is above.

The second one was broken until recently: `tools: []` compiled to "drop the built-ins",
which leaves every extension-registered tool standing. An agent declared as having no tools
fetched two web pages. If you add tools, check the allowlist still means what it says.

## Layout

```
packages/kernel   the engine. Line, Trace, the subagent, finish, save and run tools, the
                  driver, and the compute providers. No web, no HTTP server.
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
