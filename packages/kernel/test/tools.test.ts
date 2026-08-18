/**
 * The two custom tools, checked against a stub runtime.
 *
 * Both are small, and both decide something the rest of the system then obeys: whether a
 * driven run stops, and whether an agent may spend. Neither needs a model to be wrong.
 */

import { describe, expect, it } from "vitest";
import { createFinishTool } from "../src/tools/finish.ts";
import { createSubagentTool } from "../src/tools/subagent.ts";
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
