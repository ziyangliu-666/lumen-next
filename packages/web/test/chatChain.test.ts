/**
 * `chatChain`, checked without a browser.
 *
 * Compaction opens a new point for the kernel's own reasons, but nothing a person said is
 * actually gone — it is one hop back on the same line. These tests pin the walk that
 * recovers that line: it follows `compact` origins only, stops at the first origin that
 * is not `compact`, and never mistakes a `handoff` — a real, deliberate change of speaker —
 * for the same kind of edge.
 */

import { describe, expect, it } from "vitest";
import type { NodeOrigin, TraceNode } from "@lumen/kernel";
import { chatChain, initialState, type State } from "../src/state.ts";
import { emptyUsage } from "@lumen/kernel/trace/types";

/** A closed window, with only what a test bothers to vary. */
function node(id: string, parentId: string | null, origin: NodeOrigin, extra: Partial<TraceNode> = {}): TraceNode {
	return {
		id,
		parentId,
		agent: "root",
		task: `given to ${id}`,
		origin,
		depth: 0,
		state: "done",
		startedAt: 0,
		worked: 0,
		usage: emptyUsage(),
		steps: [],
		summary: `${id} says something`,
		...extra,
	};
}

/** State holding just the nodes a test built, wired up as parent/child. */
function stateOf(...nodes: TraceNode[]): State {
	const byId: Record<string, TraceNode> = {};
	for (const n of nodes) byId[n.id] = n;
	return { ...initialState, nodes: byId };
}

describe("chatChain", () => {
	it("returns just the node itself when it has no compact ancestor", () => {
		const root = node("n-1", null, { kind: "root" });
		const state = stateOf(root);

		expect(chatChain(state, "n-1")).toEqual([root]);
	});

	it("walks back across a chain of compactions, oldest first", () => {
		const first = node("n-1", null, { kind: "root" });
		const second = node("n-2", "n-1", { kind: "compact", reason: "threshold" });
		const third = node("n-3", "n-2", { kind: "compact", reason: "manual" });
		const state = stateOf(first, second, third);

		expect(chatChain(state, "n-3").map((n) => n.id)).toEqual(["n-1", "n-2", "n-3"]);
	});

	it("stops at a handoff instead of walking through it", () => {
		// A handoff is a deliberate change of speaker, not plumbing, so it stays visible as
		// its own thing — the chain must not swallow it the way it swallows a compaction.
		const handedFrom = node("n-1", null, { kind: "root" });
		const reviewer = node("n-2", "n-1", { kind: "handoff", from: "root" });
		const compacted = node("n-3", "n-2", { kind: "compact", reason: "threshold" });
		const state = stateOf(handedFrom, reviewer, compacted);

		expect(chatChain(state, "n-3").map((n) => n.id)).toEqual(["n-2", "n-3"]);
	});

	it("stops at a delegate or a branch the same way it stops at a handoff", () => {
		const parent = node("n-1", null, { kind: "root" });
		const delegated = node("n-2", "n-1", { kind: "delegate", stepId: "s1" });
		const compacted = node("n-3", "n-2", { kind: "compact", reason: "overflow" });
		const state = stateOf(parent, delegated, compacted);

		expect(chatChain(state, "n-3").map((n) => n.id)).toEqual(["n-2", "n-3"]);
	});
});
