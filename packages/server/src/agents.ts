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
 * Neither has `bash`. That is deliberate and worth stating plainly: pi ships no network
 * tool, so an agent's only route to the internet is a shell, and handing out `bash` hands
 * out unfiltered outbound access along with it.
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
			"You cannot read files. Everything you know about this repository arrives through",
			"the `subagent` tool, so delegate whenever a question touches the code, and say",
			"only what actually came back rather than what you expect to be there.",
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
		// Kept off the menu the workers read. They can delegate now, and a worker that handed
		// work to a lead would open a second conversation with a person who is not there:
		// a full window whose prompt says it is talking to somebody, holding no file tools,
		// which then delegates again. Nothing but the depth cap would end it.
		delegable: false,
	},
	{
		name: "worker",
		description:
			"Looks things up and reports back — in this repository (where something is, what a piece of code does, what is wrong with it) or on the web (search, and fetching a page's text). Give it a specific question. Returns prose, with `path:line` or a URL for anything specific.",
		systemPrompt: [
			"You answer one question, then stop.",
			"",
			"You can read this repository and you can reach the web. Prefer the repository when",
			"the question is about this code; go to the web when it is about something outside",
			"it. Read or search only as far as the question needs.",
			"",
			"Quote `path:line` or the URL for anything specific. If you cannot find something,",
			"say so and say where you looked — a confident wrong answer costs the caller more",
			"than an admission. Never present something you read on the web as if you had",
			"checked it against this code.",
			"",
			"Keep it short. Whoever asked has a context window too, and everything you write",
			"is spent from it.",
			"",
			"Do not report a problem you cannot describe a concrete failure for.",
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
		// The reason the tree can get deep. A question that needs six files read in full does
		// not fit in one window, and a worker that could only read or give up had to choose
		// between running out of room and answering from half the evidence.
		canDelegate: true,
	},
];
