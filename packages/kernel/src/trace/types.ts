/**
 * The call tree. One structure, read by the engine and drawn by the interface.
 *
 * The previous system kept a graph model beside the execution and drew the graph from
 * it. The two drifted, and a picture drawn from a second model goes wrong quietly:
 * nothing errors, the screen just stops describing what the machine did. So there is
 * one structure here and both consumers read it.
 *
 * It is not a new invention either. A subagent call is an ordinary tool call in its
 * parent's session, so the parent/child shape already exists in pi's session tree. This
 * file names it, adds the fields a person needs to read it, and streams the changes.
 */

/** Money and tokens, in pi's own shape, so nothing has to be converted on the way in. */
export interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

export function emptyUsage(): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

export function addUsage(into: Usage, from: Usage | undefined): Usage {
	if (!from) return into;
	return {
		input: into.input + (from.input ?? 0),
		output: into.output + (from.output ?? 0),
		cacheRead: into.cacheRead + (from.cacheRead ?? 0),
		cacheWrite: into.cacheWrite + (from.cacheWrite ?? 0),
		totalTokens: into.totalTokens + (from.totalTokens ?? 0),
		cost: {
			input: into.cost.input + (from.cost?.input ?? 0),
			output: into.cost.output + (from.cost?.output ?? 0),
			cacheRead: into.cost.cacheRead + (from.cost?.cacheRead ?? 0),
			cacheWrite: into.cost.cacheWrite + (from.cost?.cacheWrite ?? 0),
			total: into.cost.total + (from.cost?.total ?? 0),
		},
	};
}

/**
 * Why a node stopped. Always one of these, and always recorded.
 *
 * `aborted` is kept apart from `failed` on purpose. A user pressing stop and a tool
 * throwing are billed and retried differently, and a single word for both makes the
 * run's failure count a measure of how often the user changed their mind.
 */
export type NodeState = "running" | "done" | "failed" | "aborted";

export type StepState = "running" | "done" | "failed";

/** One tool call inside a node. Ordered, because the order is the reasoning. */
export interface Step {
	id: string;
	tool: string;
	args: unknown;
	state: StepState;
	startedAt: number;
	endedAt?: number;
	/** One line for the collapsed view: `$ pytest -q`, `read src/main.ts:1-40`. */
	title: string;
	/** First part of the result, for the collapsed view. The full result is in the session. */
	preview?: string;
	/**
	 * Nodes this step opened. Set only when the tool spawns agents. This is the single
	 * link that turns a flat list of tool calls into a call tree, and it is written by
	 * the spawning tool rather than inferred from the tool name.
	 */
	childIds?: string[];
}

/** One agent run: the root prompt, or one subagent invocation. */
export interface TraceNode {
	id: string;
	parentId: string | null;
	/** Registry name of the agent that ran. `root` for the run's own top-level agent. */
	agent: string;
	/** What it was asked to do, in the words it was asked in. */
	task: string;
	state: NodeState;
	startedAt: number;
	endedAt?: number;
	/** Its own model spend. Children are not folded in; `rollupUsage` does that on read. */
	usage: Usage;
	/** The final text it returned. This is what the parent actually received. */
	summary?: string;
	/** Present when state is `failed`. */
	error?: string;
	steps: Step[];
	model?: string;
}

export interface TraceSnapshot {
	runId: string;
	rootId: string | null;
	nodes: Record<string, TraceNode>;
	/** Child ids per node, in the order the children opened. */
	children: Record<string, string[]>;
}

export type TraceEvent =
	| { type: "node_open"; node: TraceNode }
	| { type: "node_update"; nodeId: string; patch: Partial<TraceNode> }
	| { type: "node_close"; nodeId: string; node: TraceNode }
	| { type: "step_open"; nodeId: string; step: Step }
	| { type: "step_update"; nodeId: string; stepId: string; patch: Partial<Step> }
	| { type: "step_close"; nodeId: string; stepId: string; step: Step }
	/** Streaming assistant text, so the interface can show a node thinking. */
	| { type: "text"; nodeId: string; delta: string };
