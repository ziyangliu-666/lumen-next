/**
 * `Runtime.lines()`: the plain-data view of each live line, for a durable record to hold
 * without holding the pi session itself.
 *
 * The lines are put in by hand, the same way `deliver.test.ts` does it — `openLine` would
 * build a real pi session, which needs credentials and a network, and none of what is being
 * checked here is inside it.
 */

import { describe, expect, it } from "vitest";
import { AgentRegistry, Runtime } from "../src/index.ts";
import type { Line, LineSession } from "../src/line.ts";

function noopSession(): LineSession {
	return {
		async prompt() {},
		async steer() {},
		async followUp() {},
		async abort() {},
		dispose() {},
		subscribe() {
			return () => {};
		},
		async compact() {
			return { summary: "" };
		},
	};
}

function runtimeWithLines() {
	const runtime = new Runtime({
		runId: "run-1",
		registry: new AgentRegistry([{ name: "lead", description: "d", systemPrompt: "s" }]),
		modelRuntime: {} as any,
	});
	const node = runtime.trace.openNode({
		parentId: null,
		agent: "lead",
		task: "",
		origin: { kind: "root" },
		depth: 0,
	});
	// A line whose session was given somewhere to write, and one that was not — the same
	// split `RuntimeOptions.sessionsDir` draws at construction time.
	const onDisk: Line = {
		id: "l-1",
		spec: runtime.registry.get("lead"),
		session: noopSession(),
		currentNodeId: node.id,
		depth: 0,
		stop: () => {},
		sessionFile: "/tmp/lumen-test/l-1.jsonl",
	};
	const inMemory: Line = {
		id: "l-2",
		spec: runtime.registry.get("lead"),
		session: noopSession(),
		currentNodeId: node.id,
		depth: 1,
		stop: () => {},
	};
	const byId = (runtime as unknown as { linesById: Map<string, Line> }).linesById;
	byId.set(onDisk.id, onDisk);
	byId.set(inMemory.id, inMemory);
	return { runtime, node, onDisk, inMemory };
}

describe("Runtime.lines", () => {
	it("reports id, agent, depth, node and session file for a line that has one", () => {
		const { runtime, node, onDisk } = runtimeWithLines();

		expect(runtime.lines()).toContainEqual({
			id: onDisk.id,
			agent: "lead",
			depth: 0,
			nodeId: node.id,
			sessionFile: onDisk.sessionFile,
		});
	});

	it("leaves out a line whose session never touched disk", () => {
		const { runtime, inMemory } = runtimeWithLines();

		expect(runtime.lines().some((record) => record.id === inMemory.id)).toBe(false);
	});

	it("follows a line's node as it moves, e.g. across a compaction rotation", () => {
		const { runtime, onDisk } = runtimeWithLines();
		const next = runtime.trace.openNode({
			parentId: onDisk.currentNodeId,
			agent: "lead",
			task: "continued",
			origin: { kind: "compact", reason: "threshold" },
			depth: 0,
		});
		onDisk.currentNodeId = next.id;

		expect(runtime.lines().find((record) => record.id === onDisk.id)?.nodeId).toBe(next.id);
	});
});

describe("Runtime.reopenLine", () => {
	// Both cases below throw before `createSession` ever reaches `createAgentSession`, which
	// needs a real model and network — the same reason `openLine` itself is untested here,
	// per this file's own header comment. That is also exactly the behaviour worth pinning:
	// a line that cannot come back must fail fast, on what it can check locally, rather than
	// reaching for a network call it was never going to complete.

	it("refuses an agent this registry no longer has, and leaves no line behind", async () => {
		const runtime = new Runtime({
			runId: "run-1",
			registry: new AgentRegistry([{ name: "lead", description: "d", systemPrompt: "s" }]),
			modelRuntime: {} as any,
		});

		await expect(
			runtime.reopenLine({
				id: "l-1",
				agent: "ghost",
				depth: 0,
				nodeId: "n-1",
				sessionFile: "/tmp/lumen-test/l-1.jsonl",
			}),
		).rejects.toThrow(/unknown agent ghost/);
		expect(() => runtime.line("l-1")).toThrow(/unknown line/);
	});

	it("refuses a session file that has gone missing, and leaves no line behind", async () => {
		const runtime = new Runtime({
			runId: "run-1",
			registry: new AgentRegistry([{ name: "lead", description: "d", systemPrompt: "s" }]),
			modelRuntime: {} as any,
		});

		await expect(
			runtime.reopenLine({
				id: "l-1",
				agent: "lead",
				depth: 0,
				nodeId: "n-1",
				sessionFile: "/tmp/lumen-test-nonexistent-dir/nope.jsonl",
			}),
		).rejects.toThrow(/session file is gone/);
		// The failed attempt still registered the line before `createSession` threw — see
		// `reopenLine`'s own comment on why the two are built in that order — so what
		// matters is that the failure unregisters it again rather than leaving a line with
		// no working session sitting in the runtime.
		expect(() => runtime.line("l-1")).toThrow(/unknown line/);
	});
});
