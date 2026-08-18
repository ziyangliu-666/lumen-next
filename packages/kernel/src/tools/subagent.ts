/**
 * The `subagent` tool: one agent hands work to another and reads back what it said.
 *
 * This is the only mechanism by which the call tree grows, and it is deliberately one
 * tool with four shapes rather than four tools. A model choosing between `delegate`,
 * `delegate_parallel` and `delegate_chain` picks wrongly under load; a model filling in
 * one schema states its intent in the shape of the argument.
 *
 *   { agent, task }        one agent, one task
 *   { tasks: [...] }       several agents at once, bounded concurrency
 *   { chain: [...] }       one after another, each seeing the previous output
 *   { branches: [...] }    lines that run on their own; no answer comes back
 *
 * The first three wait. The fourth does not, and that is the only difference that matters:
 * waiting is right when you need an answer to carry on, and wrong when the work is long
 * enough that blocking would freeze the conversation the person is having.
 *
 * What comes back to the caller is each child's final text and nothing else. The child's
 * tool calls, its token spend and its errors are in the trace, where a person can look
 * at them; putting them in the caller's context would spend the caller's window on
 * material it cannot act on.
 */

import type { Line } from "../line.ts";
import { Type } from "typebox";
import type { Runtime, SpawnResult } from "../runtime.ts";

export interface SubagentToolOptions {
	runtime: Runtime;
	/**
	 * The line that owns this tool. Children hang off whichever window is current when the
	 * tool is *called*, which is why the line is held rather than a node id: the line the
	 * tool was built for may have compacted several times since, and a captured id would
	 * quietly attach new children to a window that closed an hour ago.
	 */
	line: Line;
	/** Model-visible output cap per child, in characters. */
	maxOutputChars?: number;
}

const TaskShape = Type.Object({
	agent: Type.String({ description: "Name of the agent to run" }),
	task: Type.String({ description: "What it should do, in full. It sees nothing else." }),
});

const ChainStepShape = Type.Object({
	agent: Type.String({ description: "Name of the agent to run" }),
	task: Type.String({
		description:
			"What it should do. Write {previous} where the previous step's output belongs.",
	}),
});

export function createSubagentTool(options: SubagentToolOptions) {
	const { runtime, line } = options;
	const maxOutputChars = options.maxOutputChars ?? 50_000;

	return {
		name: "subagent",
		label: "Subagent",
		description: [
			"Hand a task to a specialist agent that works in its own context window and",
			"returns a written answer. Use it when the work needs a different skill, or",
			"when the material is large enough that reading it yourself would crowd out",
			"the work you are doing.",
			"",
			"Give exactly one of:",
			"  `agent` + `task`  one run, you wait for the answer",
			"  `tasks`           several at once, you wait for all of them",
			"  `chain`           in order, each step given the previous step's output",
			"  `branches`        independent lines that run on their own",
			"",
			"Use `branches` only when you do not need the answer to carry on. It returns a",
			"receipt, never results: the lines keep working after your turn ends, and the",
			"person can read them and talk to them directly. Choose it when the work is a",
			"line of enquiry rather than a question — something worth pursuing over many",
			"steps, where waiting would leave the person unable to say anything until it",
			"finished. If you need what comes back, use `tasks` instead.",
			"",
			"Available agents:",
			runtime.registry.catalogue(),
		].join("\n"),
		promptSnippet: "subagent - delegate a task to a specialist agent",
		parameters: Type.Object({
			agent: Type.Optional(Type.String({ description: "Single mode: which agent" })),
			task: Type.Optional(Type.String({ description: "Single mode: what to do" })),
			tasks: Type.Optional(
				Type.Array(TaskShape, {
					description: "Parallel mode: agents that do not depend on each other",
				}),
			),
			chain: Type.Optional(
				Type.Array(ChainStepShape, {
					description: "Chain mode: each step receives the previous step's output",
				}),
			),
			branches: Type.Optional(
				Type.Array(TaskShape, {
					description:
						"Branch mode: start independent lines and do not wait. Returns a receipt, not answers.",
				}),
			),
		}),
		async execute(toolCallId: string, params: any, signal: AbortSignal | undefined) {
			// Checked before the arguments are even read, and again per window inside `spawn`.
			// This one stops a fan-out of twenty from being attempted at all; that one stops a
			// fan-out that trips the cap halfway from finishing. A sentence in a prompt asking
			// an agent not to delegate is a request; this is what it gets when it tries anyway.
			if (runtime.overspent()) {
				return errorResult(
					`${capitalise(runtime.overspentMessage())}. Write down what you already have, ` +
						"and say plainly what is still unanswered. Do not start anything else.",
				);
			}

			const requested = describeMode(params);
			if (!requested) {
				return errorResult(
					"Give exactly one of: `agent` with `task`, or `tasks`, or `chain`, or `branches`. " +
						"Mixing them leaves it undecided whether the runs are independent, and " +
						"whether you are waiting for them.",
				);
			}

			// Both checks, not just the catalogue. Leaving an agent off the menu is a hint;
			// this is the rule. The one agent kept off it holds the conversation with the
			// person, and a worker that delegated to it would open a second conversation
			// nobody is having.
			const unknown = requested.agents.filter(
				(name) => !runtime.registry.has(name) || !runtime.registry.delegable(name),
			);
			if (unknown.length > 0) {
				return errorResult(
					`Cannot delegate to: ${unknown.join(", ")}. Available:\n${runtime.registry.catalogue()}`,
				);
			}

			// Read both late. Between this tool being built and this call happening, the
			// line may have compacted; children belong to the window that is live now.
			const nodeId = line.currentNodeId;
			const depth = line.depth + 1;

			if (requested.mode === "branch") {
				// Branches skip the concurrency cap by their nature — nothing is waiting, so
				// there is no queue to hold them in. That leaves the count itself as the only
				// place to put a limit, and it needs one: an unwatched line reads files and
				// spends tokens until it decides to stop, and the first live test of this
				// code had one wander through `node_modules` for several minutes. A cap does
				// not stop that, but it stops it happening eight times at once.
				if (requested.steps.length > runtime.maxConcurrent) {
					return errorResult(
						`Too many lines at once: ${requested.steps.length}, limit ${runtime.maxConcurrent}. ` +
							"Nothing waits for these, so each one runs until it decides to stop. " +
							"Start the most important ones now and the rest later.",
					);
				}
				const started = [];
				for (const step of requested.steps) {
					started.push(
						await runtime.startBranch({ ...step, parentNodeId: nodeId, stepId: toolCallId, depth }),
					);
				}
				return {
					content: [{ type: "text" as const, text: renderReceipt(started) }],
					details: { results: started },
				};
			}

			const results =
				requested.mode === "chain"
					? await runChain(runtime, nodeId, toolCallId, depth, requested.steps, signal)
					: await runParallel(runtime, nodeId, toolCallId, depth, requested.steps, signal);

			return {
				content: [{ type: "text" as const, text: renderForModel(results, maxOutputChars) }],
				details: { results },
				// A call where nothing came back is not a success, and drawing it with the
				// same tick as a completed one made a run the person had just cancelled read
				// as finished work. Only when *every* child failed: a partial result is still
				// something the caller can act on.
				isError: results.length > 0 && results.every((result) => !result.ok),
			};
		},
	};
}

type Mode = "single" | "parallel" | "chain" | "branch";

function describeMode(
	params: any,
): { mode: Mode; steps: { agent: string; task: string }[]; agents: string[] } | null {
	const given = [
		params.agent && params.task ? "single" : null,
		Array.isArray(params.tasks) && params.tasks.length > 0 ? "parallel" : null,
		Array.isArray(params.chain) && params.chain.length > 0 ? "chain" : null,
		Array.isArray(params.branches) && params.branches.length > 0 ? "branch" : null,
	].filter(Boolean) as Mode[];
	if (given.length !== 1) return null;

	const mode = given[0];
	const steps =
		mode === "single"
			? [{ agent: params.agent, task: params.task }]
			: mode === "parallel"
				? params.tasks
				: mode === "chain"
					? params.chain
					: params.branches;
	return { mode, steps, agents: steps.map((step: any) => step.agent) };
}

/**
 * Run independent tasks, at most `maxConcurrent` at a time.
 *
 * The cap is not politeness. Every concurrent child holds a model connection and its own
 * token budget, and an agent that asks for twelve at once on a rate-limited key gets
 * twelve failures instead of twelve answers.
 */
async function runParallel(
	runtime: Runtime,
	parentNodeId: string,
	stepId: string,
	depth: number,
	steps: { agent: string; task: string }[],
	signal: AbortSignal | undefined,
): Promise<SpawnResult[]> {
	const results: SpawnResult[] = new Array(steps.length);
	let next = 0;
	const worker = async () => {
		while (true) {
			const index = next++;
			if (index >= steps.length) return;
			results[index] = await runtime.spawn(
				{ ...steps[index], parentNodeId, stepId, depth },
				signal,
			);
		}
	};
	const lanes = Math.min(runtime.maxConcurrent, steps.length);
	await Promise.all(Array.from({ length: lanes }, worker));
	return results;
}

/**
 * Run steps in order, substituting each output into the next task.
 *
 * A failing step stops the chain. Carrying on would run the next agent on the literal
 * text `{previous}`, and it would answer, and the answer would look like work.
 */
async function runChain(
	runtime: Runtime,
	parentNodeId: string,
	stepId: string,
	depth: number,
	steps: { agent: string; task: string }[],
	signal: AbortSignal | undefined,
): Promise<SpawnResult[]> {
	const results: SpawnResult[] = [];
	let previous = "";
	for (const step of steps) {
		const task = step.task.includes("{previous}")
			? step.task.replaceAll("{previous}", previous)
			: step.task;
		const result = await runtime.spawn({ agent: step.agent, task, parentNodeId, stepId, depth }, signal);
		results.push(result);
		if (!result.ok) break;
		previous = result.output;
	}
	return results;
}

/**
 * A receipt, not an answer.
 *
 * It says what was started and nothing about how it went, because at this moment nothing
 * has gone any way yet. Saying more — even hedged — invites the model to write a summary
 * of work that has not happened, which then becomes this window's summary and reads, later,
 * exactly like a report.
 */
function renderReceipt(started: SpawnResult[]): string {
	const lines = started.map((result) =>
		result.ok
			? `- ${result.agent} is running on its own line (${result.nodeId})`
			: `- ${result.agent} could not be started: ${result.error ?? "no reason recorded"}`,
	);
	return [
		`Started ${started.filter((result) => result.ok).length} line(s):`,
		...lines,
		"",
		"No results will come back to you. They keep working after this turn ends, and the",
		"person can open them directly. Say what you started and stop; do not describe",
		"findings, because there are none yet.",
	].join("\n");
}

function renderForModel(results: SpawnResult[], maxChars: number): string {
	return results
		.map((result, index) => {
			const head = results.length > 1 ? `## ${index + 1}. ${result.agent}\n` : "";
			if (!result.ok) {
				return `${head}FAILED: ${result.error ?? "no reason recorded"}`;
			}
			const body =
				result.output.length > maxChars
					? `${result.output.slice(0, maxChars)}\n\n[truncated at ${maxChars} characters; the full text is in the trace]`
					: result.output;
			return `${head}${body}`;
		})
		.join("\n\n");
}

/** The refusal reads as a sentence to the model, and it is assembled from a clause. */
function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function errorResult(message: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		details: { results: [] as SpawnResult[] },
		isError: true,
	};
}
