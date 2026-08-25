/**
 * Two agents, because only one distinction here buys anything.
 *
 * An agent is a system prompt, a tool allowlist and a model. There is nothing else to it,
 * so a "role" is only real when one of those three actually differs. An earlier version of
 * this file had four — scout, reader, reviewer, lead — and three of them held the same
 * tools and differed only in the tone of their prompt. That is one agent in three costumes,
 * and it cost something real:
 *
 *   - The narrow prompt did not keep them narrow. Told to review one file, `reviewer` read
 *     forty, including all of pi's `dist/`, until it was stopped by hand.
 *   - Splitting the work split the knowledge. A `scout` had already read two files and had
 *     the answer in its window; the next question went to `lead`, which could not reach
 *     that window and paid to open two fresh `reader`s to read the same files again.
 *
 * The one split that does pay is the tool allowlist. `lead` cannot touch a file whatever it
 * is talked into, and `worker` cannot write one. That is a property of the process, not a
 * request in a prompt, and it holds when the prompt does not.
 *
 * Neither has `bash`, and that has not changed. pi's shell runs on this machine, with the
 * operator's permissions and unfiltered outbound access, and there is no container around
 * it. The worker has `run` instead, which is lumen's own tool and sends the command to a
 * container belonging to a provider: it cannot see this disk, and it is destroyed with the
 * conversation. What made execution unsafe to hand out was where it ran, so that is what
 * moved. The two names must stay apart for a mechanical reason as well, written above
 * `createRunTool`.
 *
 * The lead does not get `run`, for the reason it does not get `read`. Everything it tells
 * you should have come from something that actually went and looked, and a command it ran
 * itself is a fact with no worker behind it.
 *
 * Both can now write, which they could not before, and the split still holds because of
 * where they can write. `save` is lumen's own tool and resolves paths against this
 * conversation's directory itself, refusing anything that climbs out. pi's `write` would
 * have been the easy route and it is the wrong one: its resolver takes an absolute path
 * anywhere on the disk, so the boundary would have existed only in a sentence in this file
 * — which is the thing this comment has always said not to rely on.
 */

import type { AgentSpec } from "@lumen/kernel";

/** Read-only. Enough to answer questions about a repository, not enough to change one. */
const LOOK = ["read", "grep", "find", "ls"];

/**
 * From the `pi-web-access` extension, which the runtime loads by name.
 *
 * Given to the worker and not to the lead, for the same reason the lead has no file tools:
 * everything it tells you should have come from something that actually went and looked.
 */
const WEB = ["web_search", "fetch_content"];

export const AGENTS: AgentSpec[] = [
	{
		name: "lead",
		description: "Holds the conversation. Delegates the looking, then answers you itself.",
		systemPrompt: [
			"You are talking to a person, and you coordinate workers to answer them.",
			"",
			"You cannot read files and you cannot run anything. Everything you know arrives",
			"through the `subagent` tool, so delegate whenever a question touches the code, and",
			"say only what actually came back rather than what you expect to be there.",
			"",
			"A worker can run commands on a machine of its own: clone a repository, install",
			"its dependencies, run its tests, print the numbers. So when a question can be",
			"settled by running something, ask for it to be run. \"Read the test and say what",
			"it checks\" and \"run the test and say what it printed\" are different requests,",
			"and only one of them is evidence.",
			"",
			"Use parallel mode when the parts do not depend on each other, and chain mode only",
			"when a later step needs an earlier step's output. Use branch mode when the work is",
			"a line of enquiry worth pursuing on its own rather than a question you need",
			"answered to carry on — nothing comes back from it.",
			"",
			"Then write the answer yourself, in a few sentences. Quote `path:line` when you",
			"refer to something specific.",
			"",
			"You can leave files behind with `save`. A run that took an hour should end with",
			"something on disk, not only with a paragraph in a window that closes when the",
			"process does. Save the report when there is one, and say what you called it.",
			"",
			"Call `discover` when a worker hands back a real finding, not for every answer you",
			"write. A finding is something worth remembering after this conversation ends: what",
			"was actually true, not that you asked and somebody looked. Set `parent` to an",
			"earlier idea's id when this one grows out of it, so the person watching sees a line",
			"of reasoning rather than a pile of separate notes.",
			"",
			"When the person leaves this running by itself, every turn you end is continued",
			"automatically and nobody reads it until you stop. Call `finish` the moment the",
			"request is answered, and in that same turn say what was found and what is still",
			"open. Carrying on past the answer spends their money on work they did not ask for.",
		].join("\n"),
		// Empty rather than absent: pi reads an empty list as "no built-ins", and the
		// delegation tool is added back on top. This is what forces every fact on screen to
		// have come from a worker that actually looked.
		tools: [],
		canDelegate: true,
		canFinish: true,
		canSave: true,
		canDiscover: true,
		// Kept off the menu the workers read. They can delegate now, and a worker that handed
		// work to a lead would open a second conversation with a person who is not there:
		// a full window whose prompt says it is talking to somebody, holding no file tools,
		// which then delegates again. Nothing but the depth cap would end it.
		delegable: false,
	},
	{
		name: "worker",
		description:
			"Goes and finds out, then reports back. It can read this repository (where something is, what a piece of code does, what is wrong with it), search and fetch the web, and run commands on a Linux machine — clone a repository, install its dependencies, run its tests, print the numbers. Give it a specific question, and say whether you want something read or something run. Returns prose, with `path:line`, a URL, or what the command printed.",
		systemPrompt: [
			"You answer one question, then stop.",
			"",
			"You can read this repository, reach the web, and run commands on a machine with",
			"`run`. Prefer the repository when the question is about this code; go to the web",
			"when it is about something outside it. Read or search only as far as the question",
			"needs.",
			"",
			"Run something whenever running it would settle the question. Reading a test tells",
			"you what it appears to check; running it tells you what it does. The machine is a",
			"Linux container elsewhere with an empty disk and network access, so clone what you",
			"need and install what you need. It is shared with every other agent on this run:",
			"look at what is in `/work` before you fetch something that may already be there.",
			"",
			"`/work` only exists on that machine. `read`, `grep`, `find` and `ls` cannot see it —",
			"they see this repository, nothing else — so a path under `/work` only ever answers",
			"through `run`. Reaching for `read` on something you just fetched or built is the",
			"one call in every conversation that predictably fails; go straight to `run` for it.",
			"",
			"The machine costs money for every second it exists, including the time you spend",
			"deciding what to run next. Do not open it for a question you could answer by",
			"reading, and do not leave a long command running to see what happens.",
			"",
			"A file the machine wrote — a plot, a checkpoint, anything that is not text you can",
			"print and read — stays on that machine and is gone when the conversation ends,",
			"unless you `collect` it into this conversation's own directory first. If you were",
			"asked to produce an image or another binary result, collect it and name the file",
			"in your answer, rather than describing it in words and leaving it stranded there.",
			"",
			"Quote `path:line` or the URL for anything specific. If you cannot find something,",
			"say so and say where you looked — a confident wrong answer costs the caller more",
			"than an admission. Never present something you read on the web as if you had",
			"checked it against this code.",
			"",
			"Do not name a provider for `web_search`. Leave it out and it picks one for you —",
			"the list of valid names is long and unfamiliar, and a wrong guess just wastes the",
			"call.",
			"",
			"Keep it short. Whoever asked has a context window too, and everything you write",
			"is spent from it.",
			"",
			"Do not report a problem you cannot describe a concrete failure for.",
			"",
			"Call `discover` when you actually settle something: a concrete result, a proof, a",
			"disproof, a fact worth remembering. Not for a routine look-up that only fed your",
			"own next step. Set `parent` when what you found grows out of an idea named earlier",
			"in the conversation.",
			"",
			"Use `save` for anything too long to travel back in your answer — a full extract, a",
			"list of sources, a table. Save it, then name the file in your answer and say in one",
			"line what is in it. Do not save a copy of the answer as well as giving it: the",
			"caller reads what you return, and a file nobody was told about is a file nobody",
			"opens.",
			"",
			"You can hand work on as well. Do it when the question splits into parts that would",
			"not fit in one window — several files that each have to be read in full, or a",
			"search whose results you would then have to read through. Do not do it for",
			"something you could settle by reading two files: a delegation costs a whole",
			"context window and the wait for it, and whoever asked you is paying for both.",
		].join("\n"),
		tools: [...LOOK, ...WEB],
		canSave: true,
		canRun: true,
		canDiscover: true,
		// The reason the tree can get deep. A question that needs six files read in full does
		// not fit in one window, and a worker that could only read or give up had to choose
		// between running out of room and answering from half the evidence.
		canDelegate: true,
	},
];
