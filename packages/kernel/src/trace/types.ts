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

/**
 * Dollars, written out for a person or a model to read.
 *
 * Four decimals, not two. A window is often worth a fraction of a cent, and two decimals
 * printed a $0.006 cap as "$0.01" — which a lead then quoted back in its own report,
 * telling the person a number nobody had set.
 */
export function money(amount: number): string {
	return Number.isFinite(amount) ? `$${amount.toFixed(4)}` : "no cap";
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
 *
 * `aborted` is also what a `running` node in a *saved* trace becomes once it is read back
 * after the process holding it is gone — see `endInterruptedNodes` in `persist.ts`. Nobody
 * pressed stop, but the reasoning still applies: the window was ended from outside itself,
 * not by something going wrong inside it, and that is a stop, not a failure.
 */
export type NodeState = "running" | "done" | "failed" | "aborted";

/**
 * How a tool call ended.
 *
 * `aborted` is here for the same reason it is on a node: a call the person stopped and a
 * call that broke are different events, and a spawning step drawn as `failed` over
 * children labelled `stopped` contradicts the very thing it summarises.
 */
export type StepState = "running" | "done" | "failed" | "aborted";

/**
 * What a step records.
 *
 * A node's steps used to be tool calls and nothing else, so the field did not exist and
 * every reader assumed `"tool"` without asking. It stays that way: `kind` is optional,
 * absent means `"tool"`, and every reader written before this field existed keeps working
 * unchanged. `"thinking"` is a turn's reasoning, archived into the same ordered list once
 * the turn ends (see `record.ts`), so the interleaving of thought and action on screen
 * matches the order they actually happened in. `"reply"` is the same archiving for a
 * turn's own text: `TraceNode.summary` holds only the *last* reply, overwritten every turn
 * it changes, so a node that answered, called a tool, and answered again on the strength
 * of that tool's result used to have its first answer destroyed the moment the second one
 * landed — not hidden, gone, with nothing in the trace left to recover it from. A `"reply"`
 * step is that answer kept.
 *
 * `"you"` is the last thing that was not in this order. What a person types was kept in a
 * list of its own and drawn as one block above the log, so two sentences said an hour apart,
 * with a whole delegation between them, stacked together at the top as if they had been said
 * at once — and the answer to the first sat below the second. A `"you"` step puts the
 * person's own words on the same timeline as everything else, which is the only place they
 * were ever actually said.
 */
export type StepKind = "tool" | "thinking" | "reply" | "you";

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
	/**
	 * First part of the result, for the collapsed view. The full result is in the session.
	 *
	 * For a `"thinking"` or `"reply"` step this holds the reasoning or the reply text
	 * itself, in full, rather than a tool's result: neither kind of step has a result to
	 * preview, and the shape a reader wants back — "the text this step is about" — is the
	 * same field either way. A second field carrying the same kind of thing under a
	 * different name would be two places a reader has to know to check. Unlike a tool
	 * result's preview, this is never cut short: a reply is the thing this feature exists
	 * to stop losing, so it is kept whole here rather than clipped like a `bash` log nobody
	 * reads past the first screen.
	 */
	preview?: string;
	/**
	 * Whether `preview` is less than the step's whole result.
	 *
	 * Set by the recorder, never inferred on the reading side. A preview that happens to end
	 * in "..." because the tool's own output ended that way would fool a check that looked for
	 * the marker in the text; this field is the honest fact the recorder already knows —
	 * whether it cut the text short — rather than a guess reconstructed from what the cut
	 * looks like. Absent (not `false`) on a step recorded before this field existed, which
	 * reads the same as `false`: no affordance to fetch more, because there is nothing on file
	 * to fetch. See `Trace.fullResult` for where the rest of the text, if any, is kept.
	 */
	truncated?: boolean;
	/**
	 * Nodes this step opened. Set only when the tool spawns agents. This is the single
	 * link that turns a flat list of tool calls into a call tree, and it is written by
	 * the spawning tool rather than inferred from the tool name.
	 */
	childIds?: string[];
	/** See `StepKind`. Absent means `"tool"`, the historical and overwhelming default. */
	kind?: StepKind;
}

/**
 * Why this node exists, and therefore how the edge to its parent is drawn.
 *
 * The kinds anchor differently, which is the whole reason this is a union rather than a
 * string. `delegate` and `branch` hang off a tool call, so they carry the step they came
 * from and the renderer nests them there. `compact` and `handoff` have no tool call behind
 * them at all: the window was replaced by its own summary, so the node's parent is the
 * point that ended.
 *
 * `delegate` and `branch` differ by one fact — whether anyone is waiting for the answer —
 * and everything else follows from it. A delegate returns its summary into the caller's
 * window, dies with the caller's abort, and its failure is text the caller can read. A
 * branch returns nothing, outlives the caller, and if it fails the graph is the only place
 * that will ever say so.
 *
 * `compact` and `handoff` are the same physical event — a window replaced by its summary —
 * and are kept apart because they read differently to a person. A `compact` with reason
 * `threshold` means the machine hit a wall and carries no intent; a `handoff` means someone
 * decided the work should change hands. Collapsing them would let a token limit look like a
 * turn in the work.
 *
 * The renderer must read this and never infer from shape. A tool call that opened exactly
 * one child and a compaction both draw as one point leading to one point, and they mean
 * opposite things: one is work sent out, the other is the same conversation continuing
 * because the machine could not carry it any further.
 */
export type NodeOrigin =
	| { kind: "root" }
	| { kind: "delegate"; stepId: string }
	| { kind: "branch"; stepId: string; by: "model" | "you" }
	| { kind: "compact"; reason: "manual" | "threshold" | "overflow" }
	| { kind: "handoff"; from: string };

/**
 * One agent run: one context window, from the moment it opens to the moment it can hold no
 * more.
 *
 * A node is not a task and not a turn. It is a window. Delegation opens one, compaction
 * replaces one, and the agent's own think-act loop stays inside one — which is why a long
 * loop grows `steps` and never grows the tree.
 */
export interface TraceNode {
	id: string;
	parentId: string | null;
	/** Registry name of the agent that ran. `root` for the run's own top-level agent. */
	agent: string;
	/** What it was asked to do, in the words it was asked in. */
	task: string;
	origin: NodeOrigin;
	/**
	 * How many delegations deep this is. Delegation adds one; compaction does not, because
	 * a compacted window is the same conversation continuing rather than a derived one. A
	 * line that compacts often would otherwise walk itself into the depth limit and lose
	 * the ability to delegate for no reason a person could see.
	 */
	depth: number;
	state: NodeState;
	/**
	 * Whether the agent is working right now, as opposed to idle and waiting for input.
	 * Both look like `running`, and the interface has to put a spinner on one and an input
	 * box on the other.
	 */
	busy?: boolean;
	startedAt: number;
	endedAt?: number;
	/**
	 * How long this window has spent working, in milliseconds, added up over its turns.
	 *
	 * Not `endedAt - startedAt`, and the difference is the whole reason this field exists. A
	 * delegated window that has answered is deliberately never closed — it is still a live
	 * context somebody can walk into and question — so it has no `endedAt` at all, and a
	 * figure derived from its age counted upwards for as long as the server stayed running. A
	 * point that answered in forty seconds an hour ago was reading "1h 02m".
	 *
	 * Waiting for a subagent counts. The parent really was inside that turn for that long, and
	 * a lead that shows less time than the work it commissioned would be describing something
	 * nobody experienced.
	 */
	worked: number;
	/**
	 * When the current stretch of work began, or null while it is idle.
	 *
	 * Null and not undefined, because this crosses a socket as JSON and `JSON.stringify`
	 * drops an undefined value entirely. The browser merges a `node_update` patch over what
	 * it holds, so a missing key means "unchanged" — and clearing this by setting it to
	 * undefined produced a patch that said the window had stopped working while carrying no
	 * word about the clock, which went on counting on a point already drawn as finished.
	 */
	busySince?: number | null;
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
	| { type: "text"; nodeId: string; delta: string }
	/**
	 * Streaming reasoning, kept apart from `text`.
	 *
	 * Reasoning tokens arrive before the answer and are not part of it: the summary a
	 * parent receives is the text, never the thinking. The two get separate events rather
	 * than sharing one, so the interface can draw the work that produced the answer next
	 * to the answer instead of folding one into the other.
	 */
	| { type: "thinking"; nodeId: string; delta: string }
	/**
	 * A new assistant turn just began on this node.
	 *
	 * A node stays `busy` across many turns in a row — tool call, read the result, think
	 * and write again — without its context window ever closing. Without this event the
	 * interface has no way to know a fresh turn started, and keeps appending `text` and
	 * `thinking` deltas onto whatever the previous turn already left on screen.
	 */
	| { type: "turn_start"; nodeId: string };
