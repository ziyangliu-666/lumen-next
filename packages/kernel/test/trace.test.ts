/**
 * The call tree, checked without a model.
 *
 * A fake session emits pi's own event shapes, so these tests pin the thing that has to
 * be right before any agent runs: that what a person sees on screen is what the machine
 * did, and that the money adds up once.
 */

import { describe, expect, it, vi } from "vitest";
import { record, stepTitle } from "../src/trace/record.ts";
import { SUBAGENT_TOOL, toolSelection } from "../src/runtime.ts";
import { Trace } from "../src/trace/trace.ts";
import type { TraceEvent, Usage } from "../src/trace/types.ts";

function usage(input: number, output: number, cost: number): Usage {
	return {
		input,
		output,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: input + output,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: cost },
	};
}

/** A root window, which is what almost every test needs first. */
function openRoot(trace: Trace, agent = "root") {
	return trace.openNode({
		parentId: null,
		agent,
		task: "go",
		origin: { kind: "root" },
		depth: 0,
	});
}

/** Emits the events a real `AgentSession` emits, and nothing else. */
class FakeSession {
	private listeners: ((event: any) => void)[] = [];

	subscribe(listener: (event: any) => void): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((candidate) => candidate !== listener);
		};
	}

	emit(event: any): void {
		for (const listener of [...this.listeners]) listener(event);
	}

	say(text: string, spend: Usage): void {
		this.emit({ type: "message_start", message: { role: "assistant" } });
		this.emit({
			type: "message_update",
			message: { role: "assistant" },
			assistantMessageEvent: { type: "text_delta", delta: text },
		});
		this.emit({
			type: "message_end",
			message: { role: "assistant", content: [{ type: "text", text }], usage: spend, model: "m" },
		});
	}

	callTool(id: string, name: string, args: unknown, result: unknown, isError = false): void {
		this.emit({ type: "tool_execution_start", toolCallId: id, toolName: name, args });
		this.emit({ type: "tool_execution_end", toolCallId: id, toolName: name, result, isError });
	}

	compact(summary: string, spend?: Usage, reason: "manual" | "threshold" | "overflow" = "threshold") {
		this.emit({
			type: "compaction_end",
			reason,
			result: { summary, firstKeptEntryId: "e1", tokensBefore: 100, usage: spend },
			aborted: false,
			willRetry: false,
		});
	}
}

describe("trace", () => {
	it("records tool calls in the order they happened", () => {
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => node.id });

		session.callTool("t1", "read", { path: "a.ts" }, { content: [{ type: "text", text: "ok" }] });
		session.callTool("t2", "bash", { command: "pytest -q" }, { content: [] });

		expect(trace.node(node.id).steps.map((step) => step.title)).toEqual([
			"read a.ts",
			"$ pytest -q",
		]);
	});

	it("keeps the last assistant text as what the parent receives", () => {
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => node.id });

		session.say("first pass", usage(10, 5, 0.01));
		session.say("the answer is 3", usage(10, 5, 0.01));

		expect(trace.node(node.id).summary).toBe("the answer is 3");
	});

	it("does not blank the summary on a turn that was tool calls only", () => {
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => node.id });

		session.say("the answer is 3", usage(10, 5, 0.01));
		session.emit({
			type: "message_end",
			message: { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "bash" }], usage: usage(1, 1, 0) },
		});

		expect(trace.node(node.id).summary).toBe("the answer is 3");
	});

	it("adds up a subtree's spend exactly once", () => {
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => root.id });

		session.say("delegating", usage(100, 20, 0.05));
		session.emit({ type: "tool_execution_start", toolCallId: "t1", toolName: "subagent", args: { agent: "scout", task: "look" } });

		const child = trace.openNode({
			parentId: root.id,
			agent: "scout",
			task: "look",
			origin: { kind: "delegate", stepId: "t1" },
			depth: 1,
		});
		trace.linkChild(root.id, "t1", child.id);
		const childSession = new FakeSession();
		record(trace, childSession, { nodeId: () => child.id });
		childSession.say("found it", usage(200, 40, 0.11));
		trace.closeNode(child.id, "done");

		// The spawning tool reports the child's spend too. Counting both would bill the
		// subagent twice on the one screen that tells the user what the run cost.
		session.emit({
			type: "tool_execution_end",
			toolCallId: "t1",
			toolName: "subagent",
			result: { content: [{ type: "text", text: "found it" }], usage: usage(200, 40, 0.11) },
			isError: false,
		});

		expect(trace.node(root.id).usage.cost.total).toBeCloseTo(0.05);
		expect(trace.rollupUsage(root.id).cost.total).toBeCloseTo(0.16);
	});

	it("does not charge a window for a line that was merely started from it", () => {
		// A branch reports back to nobody, so it is not part of what answering cost. Folding
		// it in would put work the parent never saw into the number that says what the
		// parent's answer was worth.
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		trace.addUsage(root.id, usage(10, 5, 0.01));
		trace.openStep(root.id, { id: "t1", tool: "subagent", args: {}, title: "started 1 line" });
		const branch = trace.openNode({
			parentId: root.id,
			agent: "worker",
			task: "go",
			origin: { kind: "branch", stepId: "t1", by: "you" },
			depth: 0,
		});
		trace.linkChild(root.id, "t1", branch.id);
		trace.addUsage(branch.id, usage(400, 80, 0.5));

		expect(trace.rollupUsage(root.id).cost.total).toBeCloseTo(0.01);
		expect(trace.rollupUsage(branch.id).cost.total).toBeCloseTo(0.5);
	});

	it("does not charge a window for the window that replaced it", () => {
		// Each window is its own point with its own number. A compacted successor exists
		// only because the first one ended, so billing it backwards would say a window cost
		// more than it could have.
		const trace = new Trace("run-1");
		const first = openRoot(trace);
		trace.addUsage(first.id, usage(10, 5, 0.01));
		const second = trace.openNode({
			parentId: first.id,
			agent: "root",
			task: "summary",
			origin: { kind: "compact", reason: "threshold" },
			depth: 0,
		});
		trace.addUsage(second.id, usage(200, 40, 0.2));

		expect(trace.rollupUsage(first.id).cost.total).toBeCloseTo(0.01);
		expect(trace.rollupUsage(second.id).cost.total).toBeCloseTo(0.2);
	});

	it("still bills a plain tool that did nested model work", () => {
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => root.id });

		session.callTool("t1", "retrieve", { query: "stress" }, {
			content: [{ type: "text", text: "3 hits" }],
			usage: usage(50, 10, 0.02),
		});

		expect(trace.node(root.id).usage.cost.total).toBeCloseTo(0.02);
	});

	it("links a spawned node to the step that spawned it", () => {
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		trace.openStep(root.id, { id: "t1", tool: "subagent", args: {}, title: "subagent scout" });
		const child = trace.openNode({
			parentId: root.id,
			agent: "scout",
			task: "look",
			origin: { kind: "delegate", stepId: "t1" },
			depth: 1,
		});
		trace.linkChild(root.id, "t1", child.id);

		expect(trace.node(root.id).steps[0].childIds).toEqual([child.id]);
		expect(trace.children(root.id).map((n) => n.agent)).toEqual(["scout"]);
	});

	it("refuses to link a child to a step that does not exist", () => {
		// The old behaviour returned quietly, leaving a node with a parentId that appeared
		// in nobody's childIds: invisible on screen, spending money, and nothing logged.
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		const orphan = trace.openNode({
			parentId: root.id,
			agent: "scout",
			task: "look",
			origin: { kind: "delegate", stepId: "nope" },
			depth: 1,
		});

		expect(() => trace.linkChild(root.id, "nope", orphan.id)).toThrow(/no step nope/);
	});

	it("closes a step left open when its node ends, so nothing spins forever", () => {
		// And closes it with the node's own fate. A step the person stopped reads `stopped`
		// like everything else they stopped; calling it `failed` would put the word for a
		// broken tool on a decision they made.
		for (const fate of ["aborted", "failed", "done"] as const) {
			const trace = new Trace("run-1");
			const node = openRoot(trace);
			trace.openStep(node.id, { id: "t1", tool: "bash", args: {}, title: "$ sleep 999" });
			trace.closeNode(node.id, fate);

			expect(trace.node(node.id).steps[0].state).toBe(fate);
		}
	});

	it("keeps the first close, so done cannot overwrite aborted", () => {
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		trace.closeNode(node.id, "aborted");
		trace.closeNode(node.id, "done");

		expect(trace.node(node.id).state).toBe("aborted");
	});

	it("publishes every change so the interface can stream", () => {
		const trace = new Trace("run-1");
		const seen: TraceEvent["type"][] = [];
		trace.subscribe((event) => seen.push(event.type));

		const node = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => node.id });
		session.say("hello", usage(1, 1, 0));
		session.callTool("t1", "bash", { command: "ls" }, { content: [] });
		trace.closeNode(node.id, "done");

		expect(seen).toContain("node_open");
		expect(seen).toContain("text");
		expect(seen).toContain("step_open");
		expect(seen).toContain("step_close");
		expect(seen).toContain("node_close");
	});

	it("survives a listener that throws, because a reader must not kill the work", () => {
		const trace = new Trace("run-1");
		trace.subscribe(() => {
			throw new Error("the interface fell over");
		});
		expect(() => openRoot(trace)).not.toThrow();
	});
});

describe("compaction", () => {
	it("reports the replaced window with its summary", () => {
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		const session = new FakeSession();
		const onCompaction = vi.fn();
		record(trace, session, { nodeId: () => node.id, onCompaction });

		session.compact("we decided to use a graph", usage(500, 100, 0.03), "threshold");

		expect(onCompaction).toHaveBeenCalledWith({
			reason: "threshold",
			summary: "we decided to use a graph",
			usage: usage(500, 100, 0.03),
		});
	});

	it("bills the summarising call to the window that ran out", () => {
		// The summary is written by a real model call. Dropping it makes a line that
		// compacts often look cheaper than it was, on the one screen that reports cost.
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => node.id, onCompaction: () => {} });

		session.say("working", usage(10, 5, 0.01));
		session.compact("summary", usage(500, 100, 0.03));

		expect(trace.node(node.id).usage.cost.total).toBeCloseTo(0.04);
	});

	it("reports nothing when compaction was aborted or produced no summary", () => {
		const trace = new Trace("run-1");
		const node = openRoot(trace);
		const session = new FakeSession();
		const onCompaction = vi.fn();
		record(trace, session, { nodeId: () => node.id, onCompaction });

		session.emit({ type: "compaction_end", reason: "manual", result: undefined, aborted: true, willRetry: false });
		session.emit({
			type: "compaction_end",
			reason: "threshold",
			result: { summary: "", firstKeptEntryId: "e1", tokensBefore: 1 },
			aborted: false,
			willRetry: false,
		});

		// Nothing was replaced, so opening a node for it would draw a window that never was.
		expect(onCompaction).not.toHaveBeenCalled();
	});

	it("writes to the window that is current now, not the one it started on", () => {
		// This is the failure the frozen node id used to cause, and it is silent: work
		// keeps landing on a point the interface has already drawn as finished.
		const trace = new Trace("run-1");
		const first = openRoot(trace);
		const session = new FakeSession();
		let current = first.id;
		record(trace, session, { nodeId: () => current });

		const second = trace.openNode({
			parentId: first.id,
			agent: "root",
			task: "summary",
			origin: { kind: "compact", reason: "threshold" },
			depth: 0,
		});
		current = second.id;
		session.callTool("t9", "bash", { command: "ls" }, { content: [] });

		expect(trace.node(first.id).steps).toHaveLength(0);
		expect(trace.node(second.id).steps.map((step) => step.title)).toEqual(["$ ls"]);
	});
});

describe("a spawning step reports what its children did", () => {
	/** Open a step, hang `states` worth of children off it, then end the tool call. */
	function spawnAnd(states: ("running" | "done" | "failed" | "aborted")[], isError = false) {
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		const session = new FakeSession();
		record(trace, session, { nodeId: () => root.id });

		session.emit({ type: "tool_execution_start", toolCallId: "t1", toolName: "subagent", args: {} });
		states.forEach((state, index) => {
			const child = trace.openNode({
				parentId: root.id,
				agent: `a${index}`,
				task: "go",
				origin: { kind: "delegate", stepId: "t1" },
				depth: 1,
			});
			trace.linkChild(root.id, "t1", child.id);
			if (state !== "running") trace.closeNode(child.id, state);
		});
		session.emit({
			type: "tool_execution_end",
			toolCallId: "t1",
			toolName: "subagent",
			result: { content: [] },
			isError,
		});
		return trace.node(root.id).steps[0].state;
	}

	it("stays done when its children answered, even though they are still open", () => {
		// The regression this guards. A child that answers stays `running` on purpose — it
		// is a live window a person can go back to — so testing for "not done" marked every
		// successful delegation as a failure, in red, over children that had worked fine.
		expect(spawnAnd(["running", "running"])).toBe("done");
	});

	it("says aborted when every child was stopped, matching what the children say", () => {
		expect(spawnAnd(["aborted", "aborted"])).toBe("aborted");
	});

	it("says failed when every child broke", () => {
		expect(spawnAnd(["failed", "failed"])).toBe("failed");
	});

	it("does not claim success when the tool itself reported an error", () => {
		expect(spawnAnd(["running"], true)).toBe("failed");
	});

	it("stays done when one child worked and another did not", () => {
		// A partial result is still something the caller can act on, so the row must not
		// read as a wholesale failure.
		expect(spawnAnd(["running", "failed"])).toBe("done");
	});
});

describe("branches", () => {
	it("is drawn apart from delegation, because nothing waits for it", () => {
		// Both hang off a step, so the only thing telling them apart is `origin`. If the
		// renderer guessed from shape it would show the parent waiting on work that will
		// never report back.
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		trace.openStep(root.id, { id: "t1", tool: "subagent", args: {}, title: "started 1 line" });
		const branch = trace.openNode({
			parentId: root.id,
			agent: "reviewer",
			task: "keep looking",
			origin: { kind: "branch", stepId: "t1", by: "model" },
			depth: 1,
		});
		trace.linkChild(root.id, "t1", branch.id);

		expect(trace.node(branch.id).origin).toEqual({ kind: "branch", stepId: "t1", by: "model" });
		expect(trace.node(root.id).steps[0].childIds).toEqual([branch.id]);
	});

	it("keeps a branch alive when the window that opened it closes", () => {
		// The point of a branch. Closing the opener must not touch it, or a person who
		// moved on would silently lose the line they set going.
		const trace = new Trace("run-1");
		const root = openRoot(trace);
		trace.openStep(root.id, { id: "t1", tool: "subagent", args: {}, title: "started 1 line" });
		const branch = trace.openNode({
			parentId: root.id,
			agent: "reviewer",
			task: "keep looking",
			origin: { kind: "branch", stepId: "t1", by: "model" },
			depth: 1,
		});
		trace.linkChild(root.id, "t1", branch.id);
		trace.closeNode(root.id, "done");

		expect(trace.node(branch.id).state).toBe("running");
	});
});

describe("stepTitle", () => {
	it("says what the tool call actually does", () => {
		expect(stepTitle("bash", { command: "npm test\n--watch" })).toBe("$ npm test");
		expect(stepTitle("grep", { pattern: "corr", path: "src" })).toBe("grep /corr/ in src");
		expect(stepTitle("subagent", { tasks: [{ agent: "scout" }, { agent: "planner" }] })).toBe(
			"2 subagents in parallel: scout, planner",
		);
		expect(stepTitle("subagent", { chain: [{ agent: "scout" }, { agent: "worker" }] })).toBe(
			"chain: scout -> worker",
		);
		expect(stepTitle("subagent", { branches: [{ agent: "scout" }, { agent: "reviewer" }] })).toBe(
			"started 2 line(s): scout, reviewer",
		);
	});
});

describe("toolSelection", () => {
	const spec = (tools?: string[]) => ({
		name: "a",
		description: "d",
		systemPrompt: "s",
		tools,
	});

	it("names the delegation tool instead of dropping the built-ins", () => {
		// `noTools: "builtin"` removes the built-ins and leaves everything else — including
		// tools a loaded extension registered. A lead declared with no tools at all then
		// fetched web pages, because `pi-web-access` was loaded and its tools were never
		// built-in to begin with. Only an explicit list says what we mean.
		expect(toolSelection(spec([]), true)).toEqual({ tools: [SUBAGENT_TOOL] });
	});

	it("gives an agent that cannot delegate nothing at all", () => {
		expect(toolSelection(spec([]), false)).toEqual({ noTools: "all" });
	});

	it("adds delegation to a named list without disturbing the rest", () => {
		expect(toolSelection(spec(["read", "grep"]), true)).toEqual({
			tools: ["read", "grep", SUBAGENT_TOOL],
		});
	});

	it("does not add delegation twice", () => {
		expect(toolSelection(spec(["read", SUBAGENT_TOOL]), true)).toEqual({
			tools: ["read", SUBAGENT_TOOL],
		});
	});

	it("leaves an unset list alone, so the agent inherits the caller's tools", () => {
		expect(toolSelection(spec(undefined), true)).toEqual({});
	});
});
