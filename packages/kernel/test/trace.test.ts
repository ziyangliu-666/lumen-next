/**
 * The call tree, checked without a model.
 *
 * A fake session emits pi's own event shapes, so these tests pin the thing that has to
 * be right before any agent runs: that what a person sees on screen is what the machine
 * did, and that the money adds up once.
 */

import { describe, expect, it } from "vitest";
import { record, stepTitle } from "../src/trace/record.ts";
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
}

describe("trace", () => {
	it("records tool calls in the order they happened", () => {
		const trace = new Trace("run-1");
		const node = trace.openNode({ parentId: null, agent: "root", task: "go" });
		const session = new FakeSession();
		record(trace, node.id, session);

		session.callTool("t1", "read", { path: "a.ts" }, { content: [{ type: "text", text: "ok" }] });
		session.callTool("t2", "bash", { command: "pytest -q" }, { content: [] });

		expect(trace.node(node.id).steps.map((step) => step.title)).toEqual([
			"read a.ts",
			"$ pytest -q",
		]);
	});

	it("keeps the last assistant text as what the parent receives", () => {
		const trace = new Trace("run-1");
		const node = trace.openNode({ parentId: null, agent: "root", task: "go" });
		const session = new FakeSession();
		record(trace, node.id, session);

		session.say("first pass", usage(10, 5, 0.01));
		session.say("the answer is 3", usage(10, 5, 0.01));

		expect(trace.node(node.id).summary).toBe("the answer is 3");
	});

	it("does not blank the summary on a turn that was tool calls only", () => {
		const trace = new Trace("run-1");
		const node = trace.openNode({ parentId: null, agent: "root", task: "go" });
		const session = new FakeSession();
		record(trace, node.id, session);

		session.say("the answer is 3", usage(10, 5, 0.01));
		session.emit({
			type: "message_end",
			message: { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "bash" }], usage: usage(1, 1, 0) },
		});

		expect(trace.node(node.id).summary).toBe("the answer is 3");
	});

	it("adds up a subtree's spend exactly once", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({ parentId: null, agent: "root", task: "go" });
		const session = new FakeSession();
		record(trace, root.id, session);

		session.say("delegating", usage(100, 20, 0.05));
		session.emit({ type: "tool_execution_start", toolCallId: "t1", toolName: "subagent", args: { agent: "scout", task: "look" } });

		const child = trace.openNode({ parentId: root.id, agent: "scout", task: "look" });
		trace.linkChild(root.id, "t1", child.id);
		const childSession = new FakeSession();
		record(trace, child.id, childSession);
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

	it("still bills a plain tool that did nested model work", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({ parentId: null, agent: "root", task: "go" });
		const session = new FakeSession();
		record(trace, root.id, session);

		session.callTool("t1", "retrieve", { query: "stress" }, {
			content: [{ type: "text", text: "3 hits" }],
			usage: usage(50, 10, 0.02),
		});

		expect(trace.node(root.id).usage.cost.total).toBeCloseTo(0.02);
	});

	it("links a spawned node to the step that spawned it", () => {
		const trace = new Trace("run-1");
		const root = trace.openNode({ parentId: null, agent: "root", task: "go" });
		trace.openStep(root.id, { id: "t1", tool: "subagent", args: {}, title: "subagent scout" });
		const child = trace.openNode({ parentId: root.id, agent: "scout", task: "look" });
		trace.linkChild(root.id, "t1", child.id);

		expect(trace.node(root.id).steps[0].childIds).toEqual([child.id]);
		expect(trace.children(root.id).map((n) => n.agent)).toEqual(["scout"]);
	});

	it("closes a step left open when its node ends, so nothing spins forever", () => {
		const trace = new Trace("run-1");
		const node = trace.openNode({ parentId: null, agent: "root", task: "go" });
		trace.openStep(node.id, { id: "t1", tool: "bash", args: {}, title: "$ sleep 999" });
		trace.closeNode(node.id, "aborted");

		expect(trace.node(node.id).steps[0].state).toBe("failed");
	});

	it("keeps the first close, so done cannot overwrite aborted", () => {
		const trace = new Trace("run-1");
		const node = trace.openNode({ parentId: null, agent: "root", task: "go" });
		trace.closeNode(node.id, "aborted");
		trace.closeNode(node.id, "done");

		expect(trace.node(node.id).state).toBe("aborted");
	});

	it("publishes every change so the interface can stream", () => {
		const trace = new Trace("run-1");
		const seen: TraceEvent["type"][] = [];
		trace.subscribe((event) => seen.push(event.type));

		const node = trace.openNode({ parentId: null, agent: "root", task: "go" });
		const session = new FakeSession();
		record(trace, node.id, session);
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
		expect(() => trace.openNode({ parentId: null, agent: "root", task: "go" })).not.toThrow();
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
	});
});
