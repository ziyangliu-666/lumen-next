/**
 * The `subagent` tool: one agent hands work to another and reads back what it said.
 *
 * This is the only mechanism by which the call tree grows, and it is deliberately one
 * tool with three shapes rather than three tools. A model choosing between `delegate`,
 * `delegate_parallel` and `delegate_chain` picks wrongly under load; a model filling in
 * one schema states its intent in the shape of the argument.
 *
 *   { agent, task }        one agent, one task
 *   { tasks: [...] }       several agents at once, bounded concurrency
 *   { chain: [...] }       one after another, each seeing the previous output
 *
 * What comes back to the caller is each child's final text and nothing else. The child's
 * tool calls, its token spend and its errors are in the trace, where a person can look
 * at them; putting them in the caller's context would spend the caller's window on
 * material it cannot act on.
 */

import { Type } from "typebox";
import type { Runtime, SpawnResult } from "../runtime.ts";

export interface SubagentToolOptions {
	runtime: Runtime;
	/** The trace node of the agent that owns this tool. Its children hang off this. */
	nodeId: string;
	/** Depth of the children this tool will create. */
	depth: number;
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
	const { runtime, nodeId, depth } = options;
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
			"Give one of: `agent` + `task` for a single run, `tasks` for several at once,",
			"or `chain` for steps that each build on the last.",
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
		}),
		async execute(toolCallId: string, params: any, signal: AbortSignal | undefined) {
			const requested = describeMode(params);
			if (!requested) {
				return errorResult(
					"Give exactly one of: `agent` with `task`, or `tasks`, or `chain`. " +
						"Mixing them leaves it undecided whether the runs are independent.",
				);
			}

			const unknown = requested.agents.filter((name) => !runtime.registry.has(name));
			if (unknown.length > 0) {
				return errorResult(
					`Unknown agent(s): ${unknown.join(", ")}. Available:\n${runtime.registry.catalogue()}`,
				);
			}

			const results =
				requested.mode === "chain"
					? await runChain(runtime, nodeId, toolCallId, depth, requested.steps, signal)
					: await runParallel(runtime, nodeId, toolCallId, depth, requested.steps, signal);

			return {
				content: [{ type: "text" as const, text: renderForModel(results, maxOutputChars) }],
				details: { results },
			};
		},
	};
}

type Mode = "single" | "parallel" | "chain";

function describeMode(
	params: any,
): { mode: Mode; steps: { agent: string; task: string }[]; agents: string[] } | null {
	const given = [
		params.agent && params.task ? "single" : null,
		Array.isArray(params.tasks) && params.tasks.length > 0 ? "parallel" : null,
		Array.isArray(params.chain) && params.chain.length > 0 ? "chain" : null,
	].filter(Boolean) as Mode[];
	if (given.length !== 1) return null;

	const mode = given[0];
	const steps =
		mode === "single"
			? [{ agent: params.agent, task: params.task }]
			: mode === "parallel"
				? params.tasks
				: params.chain;
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

function errorResult(message: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		details: { results: [] as SpawnResult[] },
		isError: true,
	};
}
