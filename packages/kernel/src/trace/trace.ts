/**
 * The trace store, and the recorder that fills it from a pi session's events.
 *
 * `Trace` holds the tree and publishes every change. `record()` attaches one
 * `AgentSession` to one node in that tree. Nothing here knows what a subagent is: the
 * subagent tool opens its own child node and says which step it belongs to, so adding a
 * second kind of spawning tool later needs no change in this file.
 */

import { addUsage, emptyUsage } from "./types.ts";
import type {
	NodeOrigin,
	NodeState,
	Step,
	TraceEvent,
	TraceNode,
	TraceSnapshot,
	Usage,
} from "./types.ts";

let counter = 0;
function nextId(prefix: string): string {
	counter += 1;
	return `${prefix}-${counter.toString(36)}`;
}

export interface OpenNodeOptions {
	parentId: string | null;
	agent: string;
	task: string;
	origin: NodeOrigin;
	depth: number;
	model?: string;
}

export class Trace {
	readonly runId: string;
	private readonly nodes = new Map<string, TraceNode>();
	private readonly childIds = new Map<string, string[]>();
	private readonly listeners = new Set<(event: TraceEvent) => void>();
	private root: string | null = null;

	constructor(runId: string) {
		this.runId = runId;
	}

	get rootId(): string | null {
		return this.root;
	}

	subscribe(listener: (event: TraceEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	node(id: string): TraceNode {
		const found = this.nodes.get(id);
		if (!found) throw new Error(`unknown trace node: ${id}`);
		return found;
	}

	children(id: string): TraceNode[] {
		return (this.childIds.get(id) ?? []).map((childId) => this.node(childId));
	}

	openNode(options: OpenNodeOptions): TraceNode {
		const node: TraceNode = {
			id: nextId("n"),
			parentId: options.parentId,
			agent: options.agent,
			task: options.task,
			origin: options.origin,
			depth: options.depth,
			state: "running",
			startedAt: Date.now(),
			usage: emptyUsage(),
			steps: [],
			model: options.model,
		};
		this.nodes.set(node.id, node);
		this.childIds.set(node.id, []);
		if (node.parentId) {
			this.childIds.get(node.parentId)?.push(node.id);
		} else if (!this.root) {
			this.root = node.id;
		}
		this.emit({ type: "node_open", node });
		return node;
	}

	updateNode(id: string, patch: Partial<TraceNode>): void {
		Object.assign(this.node(id), patch);
		this.emit({ type: "node_update", nodeId: id, patch });
	}

	addUsage(id: string, usage: Usage | undefined): void {
		if (!usage) return;
		const node = this.node(id);
		node.usage = addUsage(node.usage, usage);
		this.emit({ type: "node_update", nodeId: id, patch: { usage: node.usage } });
	}

	closeNode(id: string, state: NodeState, extra?: { summary?: string; error?: string }): void {
		const node = this.node(id);
		// A node closed twice is a bug in whoever is driving it, and the second close
		// would overwrite the first state. Reporting `done` over an `aborted` is exactly
		// the case that matters, so the first word wins and the second is dropped.
		if (node.state !== "running") return;
		node.state = state;
		node.endedAt = Date.now();
		if (extra?.summary !== undefined) node.summary = extra.summary;
		if (extra?.error !== undefined) node.error = extra.error;
		// A step still open when its node closes did not finish. Leaving it `running`
		// would draw a spinner nobody will ever clear.
		for (const step of node.steps) {
			if (step.state === "running") {
				step.state = state === "running" ? "failed" : state;
				step.endedAt = node.endedAt;
			}
		}
		this.emit({ type: "node_close", nodeId: id, node });
	}

	openStep(nodeId: string, step: Omit<Step, "state" | "startedAt">): Step {
		const full: Step = { ...step, state: "running", startedAt: Date.now() };
		this.node(nodeId).steps.push(full);
		this.emit({ type: "step_open", nodeId, step: full });
		return full;
	}

	updateStep(nodeId: string, stepId: string, patch: Partial<Step>): void {
		const step = this.node(nodeId).steps.find((candidate) => candidate.id === stepId);
		if (!step) return;
		Object.assign(step, patch);
		this.emit({ type: "step_update", nodeId, stepId, patch });
	}

	closeStep(nodeId: string, stepId: string, state: StepStateArg, preview?: string): void {
		const step = this.node(nodeId).steps.find((candidate) => candidate.id === stepId);
		if (!step) return;
		step.state = state;
		step.endedAt = Date.now();
		if (preview !== undefined) step.preview = preview;
		this.emit({ type: "step_close", nodeId, stepId, step });
	}

	/**
	 * Link a spawned node to the step that spawned it. The one call that builds the tree.
	 *
	 * Throws when the step is missing rather than returning quietly. A child that fails to
	 * link still has a `parentId`, so it looks attached in the data and appears in nobody's
	 * `childIds` — it is simply absent from the picture, with nothing logged. That is the
	 * worst shape a bug can take here, because the screen stays plausible while an agent
	 * runs and spends money off-camera.
	 */
	linkChild(nodeId: string, stepId: string, childId: string): void {
		const step = this.node(nodeId).steps.find((candidate) => candidate.id === stepId);
		if (!step) {
			throw new Error(
				`cannot link child ${childId}: node ${nodeId} has no step ${stepId}. ` +
					"A spawn needs a step to hang from; open one first.",
			);
		}
		step.childIds = [...(step.childIds ?? []), childId];
		this.emit({ type: "step_update", nodeId, stepId, patch: { childIds: step.childIds } });
	}

	/**
	 * What this window cost to answer: its own spend, plus the work it delegated.
	 *
	 * Only delegation folds upward, because only delegation was paid for by this window and
	 * came back into it. The other two kinds of child are their own windows and carry their
	 * own numbers:
	 *
	 *   branch    nothing returned from it. It was started here and went its own way, so
	 *             charging it to this window overstates what answering actually cost.
	 *   compact   the window that replaced this one. Folding it in would say "this window
	 *             cost X" where X includes a window that only exists because this one ended.
	 *   handoff   the same, with a different agent holding it.
	 *
	 * Nothing is lost by excluding them: every point carries its own spend, and the run's
	 * total is the sum of those, added once.
	 *
	 * Kept as a function rather than a stored field. A stored rollup has to be invalidated
	 * up the whole chain on every child update, and the first time that is missed the number
	 * on screen is wrong in the direction that costs the user money.
	 */
	rollupUsage(id: string): Usage {
		let total = addUsage(emptyUsage(), this.node(id).usage);
		for (const childId of this.childIds.get(id) ?? []) {
			if (this.node(childId).origin.kind !== "delegate") continue;
			total = addUsage(total, this.rollupUsage(childId));
		}
		return total;
	}

	snapshot(): TraceSnapshot {
		return {
			runId: this.runId,
			rootId: this.root,
			nodes: Object.fromEntries(
				[...this.nodes.entries()].map(([id, node]) => [id, structuredClone(node)]),
			),
			children: Object.fromEntries(
				[...this.childIds.entries()].map(([id, ids]) => [id, [...ids]]),
			),
		};
	}

	emit(event: TraceEvent): void {
		for (const listener of this.listeners) {
			// One broken listener must not stop the others, and must never stop the run.
			// The interface is a reader here; a reader cannot be allowed to kill the work.
			try {
				listener(event);
			} catch (error) {
				console.error("trace listener threw", error);
			}
		}
	}
}

type StepStateArg = "done" | "failed" | "aborted";
