/**
 * The trace, rebuilt in the browser from the events the server forwards.
 *
 * There is no translation layer on purpose. The event names are the case labels and the
 * state is the same shape the server holds, so there is exactly one description of what a
 * run is. A second vocabulary here would be a second thing to keep in step, and the way
 * that fails is silent: nothing errors, the picture just stops matching the machine.
 */

// The two value imports come from the leaf module, not the package barrel. The barrel
// re-exports `Runtime`, which pulls pi and every model SDK behind it — 4 MB of Node-only
// code that would end up in the browser bundle for the sake of two arithmetic helpers.
import { addUsage, emptyUsage } from "@lumen/kernel/trace/types";
import type { AgentSpec, TraceNode, Usage } from "@lumen/kernel";
// Type-only, so nothing from the server package is bundled. One definition of the wire
// format, imported by both ends, rather than a copy here that can drift out of step.
import type { AutoState, Fixed, ServerFrame, Settings, Target } from "@lumen/server/protocol";

export interface State {
	nodes: Record<string, TraceNode>;
	children: Record<string, string[]>;
	rootId: string | null;
	agents: AgentSpec[];
	/** Where your typing goes. */
	selected: string | null;
	/** Text streaming in right now, per node. Cleared when a node starts a fresh turn. */
	live: Record<string, string>;
	/** What you have said, per node, so the page reads as a conversation and not a log. */
	saidBy: Record<string, string[]>;
	messages: { level: "error" | "notice"; text: string }[];
	connected: boolean;
	/** The switch: whether the lead is carrying on by itself, and what it may spend. */
	auto: AutoState;
	/** What can be changed about this run, and what was fixed when the server started. */
	settings: Settings | null;
	fixed: Fixed | null;
}

export const initialState: State = {
	nodes: {},
	children: {},
	rootId: null,
	agents: [],
	selected: null,
	live: {},
	saidBy: {},
	messages: [],
	connected: false,
	// Until `hello` arrives there is no run to know anything about.
	auto: { on: false, turns: 0 },
	// Null until `hello`. The panel cannot be drawn from guesses: an invented model list
	// would offer models this machine has no credentials for.
	settings: null,
	fixed: null,
};

export type Action =
	| { kind: "frame"; frame: ServerFrame }
	| { kind: "select"; nodeId: string }
	| { kind: "said"; nodeId: string; text: string }
	| { kind: "clearMessages" }
	| { kind: "connection"; connected: boolean };

export function reduce(state: State, action: Action): State {
	switch (action.kind) {
		case "connection":
			return { ...state, connected: action.connected };
		case "clearMessages":
			return state.messages.length ? { ...state, messages: [] } : state;
		case "select":
			localStorage.setItem("lumen.selected", action.nodeId);
			return { ...state, selected: action.nodeId };
		case "said": {
			// Mark it busy here rather than waiting for the server to say so. For the second
			// or so before that frame arrives, the point sat idle showing its previous
			// answer underneath the new question — which reads as "that was the reply".
			// The server's own `busy` frames overwrite this either way.
			const node = state.nodes[action.nodeId];
			// Only when this sentence starts a turn. A sentence typed at a point that is
			// already working joins the turn instead, and clearing the buffer there would
			// wipe the paragraph the agent is in the middle of writing — the deltas that
			// follow would append to nothing and the first half would be gone.
			const starting = node?.busy !== true;
			return {
				...state,
				nodes: node ? { ...state.nodes, [action.nodeId]: { ...node, busy: true } } : state.nodes,
				live: starting ? { ...state.live, [action.nodeId]: "" } : state.live,
				saidBy: {
					...state.saidBy,
					[action.nodeId]: [...(state.saidBy[action.nodeId] ?? []), action.text],
				},
			};
		}
		case "frame":
			return applyFrame(state, action.frame);
	}
}

function applyFrame(state: State, frame: ServerFrame): State {
	switch (frame.type) {
		case "hello": {
			// Come back to where you were standing, if that window still exists. Falling
			// back to the root every time would quietly move a person off the line they
			// were working on, and the move would look like their own doing.
			// Where you were, or the window that replaced it. Falling straight back to the
			// root stranded people on a dead point: after any handover the root is itself
			// closed, so a plain refresh opened with the composer disabled and the live
			// point somewhere else on the page.
			const remembered = localStorage.getItem("lumen.selected");
			const restored = { ...state, nodes: frame.snapshot.nodes, children: frame.snapshot.children };
			const stillLive = remembered ? frontierOf(restored as State, remembered) : null;
			const rootLive = frame.rootNodeId ? frontierOf(restored as State, frame.rootNodeId) : null;
			return {
				...state,
				agents: frame.agents,
				auto: frame.auto,
				settings: frame.settings,
				fixed: frame.fixed,
				nodes: frame.snapshot.nodes,
				children: frame.snapshot.children,
				rootId: frame.snapshot.rootId,
				saidBy: frame.said,
				selected: state.selected ?? stillLive ?? rootLive ?? frame.rootNodeId,
			};
		}

		case "auto":
			return { ...state, auto: frame.state };

		case "settings":
			return { ...state, settings: frame.settings };

		case "error":
			return { ...state, messages: [...state.messages, { level: "error", text: frame.message }] };

		case "notice":
			return { ...state, messages: [...state.messages, { level: "notice", text: frame.message }] };

		case "node_open": {
			const node = frame.node;
			const children = { ...state.children, [node.id]: state.children[node.id] ?? [] };
			if (node.parentId) {
				children[node.parentId] = [...(children[node.parentId] ?? []), node.id];
			}
			// Follow the conversation when it moves on its own. A window that was replaced
			// cannot be typed into, so leaving the cursor there would strand the person on a
			// dead point with no hint that the live one is elsewhere.
			const followed =
				(node.origin.kind === "compact" || node.origin.kind === "handoff") &&
				state.selected === node.parentId;
			return {
				...state,
				nodes: { ...state.nodes, [node.id]: node },
				children,
				rootId: state.rootId ?? (node.parentId ? state.rootId : node.id),
				selected: followed ? node.id : state.selected,
			};
		}

		case "node_update": {
			const existing = state.nodes[frame.nodeId];
			if (!existing) return state;
			const merged = { ...existing, ...frame.patch };
			// A turn beginning is the one moment the live text should start over. Without
			// this the next reply arrives glued to the previous one.
			const startedWorking = frame.patch.busy === true && !existing.busy;
			return {
				...state,
				nodes: { ...state.nodes, [frame.nodeId]: merged },
				live: startedWorking ? { ...state.live, [frame.nodeId]: "" } : state.live,
			};
		}

		case "node_close":
			return { ...state, nodes: { ...state.nodes, [frame.nodeId]: frame.node } };

		case "step_open": {
			const node = state.nodes[frame.nodeId];
			if (!node) return state;
			return {
				...state,
				nodes: {
					...state.nodes,
					[frame.nodeId]: { ...node, steps: [...node.steps, frame.step] },
				},
			};
		}

		case "step_update":
		case "step_close": {
			const node = state.nodes[frame.nodeId];
			if (!node) return state;
			const patch = frame.type === "step_close" ? frame.step : frame.patch;
			return {
				...state,
				nodes: {
					...state.nodes,
					[frame.nodeId]: {
						...node,
						steps: node.steps.map((step) =>
							step.id === frame.stepId ? { ...step, ...patch } : step,
						),
					},
				},
			};
		}

		case "text":
			return {
				...state,
				live: { ...state.live, [frame.nodeId]: (state.live[frame.nodeId] ?? "") + frame.delta },
			};

		default:
			return state;
	}
}

/**
 * What this window cost to answer: its own spend, plus the work it delegated.
 *
 * Only delegation folds upward. A branch never reported back, and a compacted or handed-over
 * successor is a different window that only exists because this one ended — charging either
 * to this point would answer a question nobody asked. The same rule as the server's
 * `rollupUsage`, recomputed rather than sent: a stored total has to be invalidated up the
 * whole chain on every child update, and the first time that is missed the number on screen
 * is wrong in the direction that costs the user money.
 */
export function rollup(state: State, id: string): Usage {
	let total = addUsage(emptyUsage(), state.nodes[id]?.usage);
	for (const childId of state.children[id] ?? []) {
		if (state.nodes[childId]?.origin.kind !== "delegate") continue;
		total = addUsage(total, rollup(state, childId));
	}
	return total;
}

/** Whether this point commissioned work that came back to it, and so has a total worth showing. */
export function hasDelegated(state: State, id: string): boolean {
	return (state.children[id] ?? []).some((c) => state.nodes[c]?.origin.kind === "delegate");
}

/** Children that continue this line, as opposed to work sent out from a tool call. */
export function successors(state: State, id: string): TraceNode[] {
	return (state.children[id] ?? [])
		.map((childId) => state.nodes[childId])
		.filter((node) => node && (node.origin.kind === "compact" || node.origin.kind === "handoff"));
}

/**
 * Whether this window still exists, and can therefore be talked to.
 *
 * Not a policy. A closed node is one whose context window is gone — replaced by a summary,
 * or ended with the run — and there is nothing left to send a message to.
 */
export function isLive(node: TraceNode): boolean {
	return node.state === "running";
}

/**
 * Walk forward from a closed point to the window that replaced it, and keep walking.
 *
 * Standing on a closed point is a normal thing to do — you clicked it to read it. The
 * interface owes you the way back to where the conversation actually is, rather than
 * quietly routing your next sentence somewhere you did not choose.
 */
export function frontierOf(state: State, id: string): string | null {
	const node = state.nodes[id];
	if (!node) return null;
	if (isLive(node)) return id;
	for (const childId of state.children[id] ?? []) {
		const child = state.nodes[childId];
		if (!child) continue;
		if (child.origin.kind === "compact" || child.origin.kind === "handoff") {
			return frontierOf(state, childId);
		}
	}
	return null;
}

export function describeTarget(target: Target): string {
	switch (target.kind) {
		case "continue":
			return "keeps everything it already knows";
		case "queue":
			return "it finishes what it is doing, then reads this";
		case "cutIn":
			return "it reads this before its next thought, and keeps the workers it started";
		case "next":
			return "starts a fresh window from a summary of this one";
		case "handoff":
			return `hands the summary to ${target.agent}; this line ends here`;
		case "send":
			return `${target.agent} gets your sentence and nothing else; you stay here`;
	}
}

/**
 * Nodes worth offering as `@` citations: anything that has actually said something.
 *
 * Quoting a point that has not spoken yet would paste "(nothing yet)" into the task, which
 * reads to the next agent as a finding rather than an absence.
 */
export function quotable(state: State): TraceNode[] {
	return Object.values(state.nodes).filter((node) => (node.summary ?? "").trim().length > 0);
}
