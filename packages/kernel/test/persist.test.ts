/**
 * The durable record, checked as pure data.
 *
 * `persist.ts` deliberately touches no filesystem — the reading and writing live in
 * `packages/server/src/persist.ts`, outside this package's reach. What is tested here is
 * everything that can go wrong without one: a snapshot that does not survive a trip through
 * JSON, a `running` node coming back as though nothing had happened, and a record this build
 * does not recognise being trusted anyway.
 */

import { describe, expect, it } from "vitest";
import { IdeaGraph } from "../src/ideas.ts";
import {
	SCHEMA_VERSION,
	endInterruptedNodes,
	parseConversationRecord,
	reconcileResumedTrace,
	type ConversationRecordV2,
} from "../src/persist.ts";
import { Trace } from "../src/trace/trace.ts";

/** A record with a node of every kind of step, a delegated child, and two linked ideas. */
function buildRecord(): ConversationRecordV2 {
	const trace = new Trace("run-1");
	const root = trace.openNode({
		parentId: null,
		agent: "root",
		task: "go",
		origin: { kind: "root" },
		depth: 0,
	});
	trace.addUsage(root.id, {
		input: 10,
		output: 5,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 15,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 },
	});
	trace.openStep(root.id, { id: "t1", tool: "read", args: { path: "a.ts" }, title: "read a.ts" });
	trace.closeStep(root.id, "t1", "done", "ok", false);
	trace.openStep(root.id, { id: "t2", tool: "reasoning", args: {}, title: "thinking", kind: "thinking" });
	trace.closeStep(root.id, "t2", "done", "let me see");
	trace.openStep(root.id, { id: "t3", tool: "reply", args: {}, title: "reply", kind: "reply" });
	trace.closeStep(root.id, "t3", "done", "the answer is 3");
	trace.openStep(root.id, { id: "t4", tool: "subagent", args: { agent: "scout" }, title: "subagent scout" });

	const child = trace.openNode({
		parentId: root.id,
		agent: "scout",
		task: "look",
		origin: { kind: "delegate", stepId: "t4" },
		depth: 1,
	});
	trace.linkChild(root.id, "t4", child.id);
	trace.closeStep(root.id, "t4", "done", "found it");
	trace.closeNode(child.id, "done", { summary: "found it" });

	const ideas = new IdeaGraph("run-1");
	const finding = ideas.add({
		title: "a finding",
		summary: "it works",
		kind: "finding",
		nodeId: root.id,
		parentId: null,
		citedNodeIds: [],
	});
	ideas.add({
		title: "a direction",
		summary: "keep looking",
		kind: "direction",
		nodeId: child.id,
		parentId: finding.id,
		citedNodeIds: [root.id],
	});

	return {
		version: SCHEMA_VERSION,
		key: "s-test",
		startedAt: 1_000,
		savedAt: 2_000,
		spend: 0.01,
		model: "deepseek/deepseek-v4-flash",
		trace: trace.snapshot(),
		ideas: ideas.snapshot(),
		said: { [root.id]: ["go look for it"] },
		lines: [{ id: "l-1", agent: "root", depth: 0, nodeId: root.id, sessionFile: "/tmp/x.jsonl" }],
	};
}

describe("conversation record", () => {
	it("round-trips a trace with steps of every kind, and its ideas, through JSON", () => {
		const record = buildRecord();
		const roundTripped = JSON.parse(JSON.stringify(record));

		expect(roundTripped).toEqual(record);
		expect(parseConversationRecord(roundTripped)).toEqual(record);
	});

	it("closes a running node honestly, rather than leaving a spinner nothing will ever clear", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});
		trace.setBusy(root.id, true);
		trace.openStep(root.id, { id: "t1", tool: "bash", args: {}, title: "$ sleep 999" });

		const closed = endInterruptedNodes(trace.snapshot(), 5_000);

		expect(closed.nodes[root.id].state).toBe("aborted");
		expect(closed.nodes[root.id].busy).toBe(false);
		expect(closed.nodes[root.id].busySince).toBeNull();
		// The busy stretch is banked up to `until`, the same as a real `closeNode` would —
		// `setBusy` opened it at whatever `Date.now()` was, so only the shape is checked here.
		expect(closed.nodes[root.id].worked).toBeGreaterThanOrEqual(0);
		expect(closed.nodes[root.id].steps[0].state).toBe("aborted");
	});

	it("leaves a node that already finished untouched", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});
		trace.closeNode(root.id, "done", { summary: "ok" });
		const before = trace.snapshot();

		const closed = endInterruptedNodes(before, 5_000);

		expect(closed).toEqual(before);
	});

	it("refuses a record with no schema version, rather than half-loading it", () => {
		expect(parseConversationRecord({ key: "x" })).toBeNull();
		expect(parseConversationRecord(null)).toBeNull();
		expect(parseConversationRecord("not even an object")).toBeNull();
	});

	it("refuses a record from a schema version this build does not know", () => {
		const record = buildRecord();
		expect(parseConversationRecord({ ...record, version: 999 })).toBeNull();
	});

	it("still reads back a version-1 record with no line records at all", () => {
		const { lines: _dropped, ...v1 } = buildRecord();
		const record = { ...v1, version: 1 as const };

		expect(parseConversationRecord(record)).toEqual(record);
	});

	it("refuses a version-2 record whose `lines` is missing or not an array", () => {
		const { lines: _dropped, ...withoutLines } = buildRecord();
		expect(parseConversationRecord(withoutLines)).toBeNull();
		expect(parseConversationRecord({ ...buildRecord(), lines: "not an array" })).toBeNull();
	});

	it("refuses a record missing a required field even under today's version", () => {
		const { trace: _dropped, ...withoutTrace } = buildRecord();
		expect(parseConversationRecord(withoutTrace)).toBeNull();
	});
});

describe("reconcileResumedTrace", () => {
	it("keeps a reachable line's window open, but clears the busy stretch nobody is finishing", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});
		trace.setBusy(root.id, true);
		trace.openStep(root.id, { id: "t1", tool: "bash", args: {}, title: "$ sleep 999" });

		const reconciled = reconcileResumedTrace(trace.snapshot(), 5_000, new Map([[root.id, null]]));

		// Still a live point: this is the one difference from `endInterruptedNodes`, which
		// has no way to know the line came back and closes every `running` node it sees.
		expect(reconciled.nodes[root.id].state).toBe("running");
		expect(reconciled.nodes[root.id].busy).toBe(false);
		expect(reconciled.nodes[root.id].busySince).toBeNull();
		expect(reconciled.nodes[root.id].steps[0].state).toBe("aborted");
		expect(reconciled.nodes[root.id].endedAt).toBeUndefined();
	});

	it("closes an unreachable line's window to failed, carrying why on the point itself", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});

		const reconciled = reconcileResumedTrace(
			trace.snapshot(),
			5_000,
			new Map([[root.id, "its saved session file is gone: /tmp/x.jsonl"]]),
		);

		expect(reconciled.nodes[root.id].state).toBe("failed");
		expect(reconciled.nodes[root.id].error).toBe("its saved session file is gone: /tmp/x.jsonl");
		expect(reconciled.nodes[root.id].busy).toBe(false);
	});

	it("closes a running node no outcome accounts for, the same way endInterruptedNodes would", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});

		const reconciled = reconcileResumedTrace(trace.snapshot(), 5_000, new Map());

		expect(reconciled.nodes[root.id].state).toBe("aborted");
	});

	it("leaves a node that already finished untouched", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});
		trace.closeNode(root.id, "done", { summary: "ok" });
		const before = trace.snapshot();

		const reconciled = reconcileResumedTrace(before, 5_000, new Map([[root.id, null]]));

		expect(reconciled).toEqual(before);
	});

	it("leaves a reachable, idle window untouched when nothing was caught mid-flight", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({
			parentId: null,
			agent: "root",
			task: "go",
			origin: { kind: "root" },
			depth: 0,
		});
		const before = trace.snapshot();

		const reconciled = reconcileResumedTrace(before, 5_000, new Map([[root.id, null]]));

		expect(reconciled).toEqual(before);
	});
});
