/**
 * The custom tools, checked against a stub runtime.
 *
 * All three are small, and each decides something the rest of the system then obeys:
 * whether a driven run stops, whether an agent may spend, and what lands in the findings
 * graph. None of them needs a model to be wrong.
 */

import { describe, expect, it } from "vitest";
import { Value } from "typebox/value";
import { createDiscoverTool } from "../src/tools/discover.ts";
import { createFinishTool } from "../src/tools/finish.ts";
import { createSubagentTool } from "../src/tools/subagent.ts";
import type { Idea } from "../src/ideas.ts";
import type { Line } from "../src/line.ts";
import type { Runtime } from "../src/runtime.ts";

function stubRuntime(overrides: Partial<Runtime> = {}) {
	const declared: { lineId: string; reason: string }[] = [];
	const runtime = {
		maxConcurrent: 4,
		overspent: () => false,
		overspentMessage: () => "this run has spent $2.0000 of its $2.0000 cap; no more agents can be started",
		registry: {
			catalogue: () => "worker — looks things up",
			has: () => true,
			delegable: () => true,
		},
		declareFinish(lineId: string, reason: string) {
			declared.push({ lineId, reason });
		},
		...overrides,
	} as unknown as Runtime;
	return { runtime, declared };
}

const line = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;

function textOf(result: any): string {
	return result.content.map((part: any) => part.text).join("");
}

describe("finish", () => {
	it("records the declaration against the line that made it", async () => {
		const { runtime, declared } = stubRuntime();
		const tool = createFinishTool({ runtime, line });

		const result = await tool.execute("t1", { reason: "every part is answered" });

		expect(declared).toEqual([{ lineId: "l-1", reason: "every part is answered" }]);
		expect(result.isError).toBeUndefined();
		// The tool tells the model this turn is its last. An agent that saved the detail for
		// a turn that never comes leaves the person with a summary of nothing.
		expect(textOf(result)).toContain("write your answer now");
	});

	it("refuses a declaration with no reason", async () => {
		const { runtime, declared } = stubRuntime();
		const tool = createFinishTool({ runtime, line });

		const result = await tool.execute("t1", { reason: "  " });

		expect(result.isError).toBe(true);
		// Nothing recorded, so the run carries on. A run that ended with no reason given
		// leaves an answered question and an abandoned one looking the same.
		expect(declared).toEqual([]);
	});
});

describe("subagent", () => {
	it("refuses every call while delegation is blocked, and says why", async () => {
		const { runtime } = stubRuntime({ overspent: () => true } as Partial<Runtime>);
		const tool = createSubagentTool({ runtime, line });

		const result = await tool.execute("t1", { agent: "worker", task: "look" }, undefined);

		// The last turn of a run must be able to write but not to spend. A sentence in a
		// prompt asking an agent not to delegate is a request; this is what it gets when it
		// tries anyway.
		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("no more agents can be started");
	});

	it("still refuses a badly shaped call when nothing is blocked", async () => {
		const { runtime } = stubRuntime();
		const tool = createSubagentTool({ runtime, line });

		const result = await tool.execute("t1", { agent: "worker", tasks: [] }, undefined);

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("exactly one of");
	});
});

/** Just enough Runtime for `discover`: a trace to check citations against, and an idea store. */
function fakeIdeaRuntime(knownNodeIds: string[]) {
	const stored: Idea[] = [];
	const byId = new Map<string, Idea>();
	let counter = 0;
	const runtime = {
		trace: {
			node(id: string) {
				if (!knownNodeIds.includes(id)) throw new Error(`unknown trace node: ${id}`);
				return { id };
			},
		},
		ideas: {
			get(id: string) {
				return byId.get(id);
			},
			add(input: { title: string; summary: string; nodeId: string; parentId: string | null; citedNodeIds: string[] }) {
				counter += 1;
				const idea = { id: `i-${counter}`, createdAt: 0, ...input } as Idea;
				byId.set(idea.id, idea);
				stored.push(idea);
				return idea;
			},
		},
	} as unknown as Runtime;
	return { runtime, stored };
}

describe("discover", () => {
	it("adds an idea located at the calling line's current node", async () => {
		const { runtime, stored } = fakeIdeaRuntime(["n-1"]);
		const discoverLine = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;
		const tool = createDiscoverTool({ runtime, line: discoverLine });

		const result: any = await tool.execute("t1", {
			title: "found it",
			summary: "a real result",
			kind: "finding",
		});

		expect(result.isError).toBeUndefined();
		expect(stored).toHaveLength(1);
		expect(stored[0].nodeId).toBe("n-1");
		expect(stored[0].parentId).toBeNull();
		expect(textOf(result)).toContain(stored[0].id);
	});

	it("extracts only citations that name a point that actually exists", async () => {
		const { runtime, stored } = fakeIdeaRuntime(["n-1"]);
		const discoverLine = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;
		const tool = createDiscoverTool({ runtime, line: discoverLine });

		await tool.execute("t1", {
			title: "found it",
			summary: "backed by @n-1 and supposedly @n-99",
			kind: "finding",
		});

		expect(stored[0].citedNodeIds).toEqual(["n-1"]);
	});

	it("refuses an unknown parent and adds nothing", async () => {
		const { runtime, stored } = fakeIdeaRuntime(["n-1"]);
		const discoverLine = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;
		const tool = createDiscoverTool({ runtime, line: discoverLine });

		const result: any = await tool.execute("t1", {
			title: "found it",
			summary: "a real result",
			kind: "finding",
			parent: "i-nope",
		});

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("No such idea");
		expect(stored).toHaveLength(0);
	});

	it("links to a valid parent", async () => {
		const { runtime, stored } = fakeIdeaRuntime(["n-1"]);
		const discoverLine = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;
		const tool = createDiscoverTool({ runtime, line: discoverLine });

		const first: any = await tool.execute("t1", { title: "root", summary: "a first result", kind: "direction" });
		const second: any = await tool.execute("t2", {
			title: "grows from it",
			summary: "a second result",
			kind: "finding",
			parent: first.details.id,
		});

		expect(second.isError).toBeUndefined();
		expect(stored[1].parentId).toBe(first.details.id);
	});

	it("passes kind straight through from the call to the stored idea", async () => {
		const { runtime, stored } = fakeIdeaRuntime(["n-1"]);
		const discoverLine = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;
		const tool = createDiscoverTool({ runtime, line: discoverLine });

		await tool.execute("t1", { title: "a path worth trying", summary: "worth a look", kind: "direction" });

		expect(stored[0].kind).toBe("direction");
	});

	it("rejects a missing or invalid kind at the schema, the same as any other malformed call", () => {
		const { runtime } = fakeIdeaRuntime(["n-1"]);
		const discoverLine = { id: "l-1", currentNodeId: "n-1", depth: 0 } as unknown as Line;
		const tool = createDiscoverTool({ runtime, line: discoverLine });

		const base = { title: "found it", summary: "a real result" };
		expect(Value.Check(tool.parameters, { ...base, kind: "finding" })).toBe(true);
		expect(Value.Check(tool.parameters, base)).toBe(false);
		expect(Value.Check(tool.parameters, { ...base, kind: "guess" })).toBe(false);
	});
});
