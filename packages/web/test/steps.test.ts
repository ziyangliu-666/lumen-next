/**
 * Grouping the step list, checked without a browser.
 *
 * The panel is the only place a person reads what an agent actually did, so every test here
 * pins one property of that account: the order it reports, and the rows it refuses to hide.
 */

import { describe, expect, it } from "vitest";
import type { Step } from "@lumen/kernel";
import { groupSteps } from "../src/steps.ts";

/** A finished step. Only `tool` and the id vary in most tests, so the rest has defaults. */
function step(id: string, tool: string, extra: Partial<Step> = {}): Step {
	return {
		id,
		tool,
		args: {},
		state: "done",
		startedAt: 0,
		endedAt: 1,
		title: `${tool} ${id}`,
		...extra,
	};
}

describe("groupSteps", () => {
	it("returns nothing for a window that has not called a tool", () => {
		expect(groupSteps([])).toEqual([]);
	});

	it("keeps a lone step's own title", () => {
		const runs = groupSteps([step("s1", "grep")]);

		expect(runs).toHaveLength(1);
		expect(runs[0].title).toBe("grep s1");
		expect(runs[0].tool).toBe("grep");
		expect(runs[0].steps.map((s) => s.id)).toEqual(["s1"]);
	});

	it("folds consecutive calls to the same tool into one run", () => {
		const runs = groupSteps([step("s1", "grep"), step("s2", "grep"), step("s3", "grep")]);

		expect(runs).toHaveLength(1);
		expect(runs[0].title).toBe("3 grep calls");
		expect(runs[0].steps.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
	});

	it("does not merge across a different tool in the middle", () => {
		// The regression the whole file exists to avoid. Merging the four greps into one run
		// would place s4 next to s1 on screen, and a reader would take the read that happened
		// between them as having come first or last. The order of the steps is the reasoning.
		const runs = groupSteps([
			step("s1", "grep"),
			step("s2", "grep"),
			step("s3", "read"),
			step("s4", "grep"),
			step("s5", "grep"),
		]);

		expect(runs.map((run) => run.title)).toEqual(["2 grep calls", "read s3", "2 grep calls"]);
		expect(runs.flatMap((run) => run.steps.map((s) => s.id))).toEqual([
			"s1",
			"s2",
			"s3",
			"s4",
			"s5",
		]);
	});

	it("leaves a step that opened children alone, and breaks the run around it", () => {
		// This row is the call tree. The renderer draws one line per child under it, so inside
		// a count there is nothing left to draw and the panel stops showing the delegation at
		// all. Same tool on both sides, so nothing but `childIds` can keep it out.
		const runs = groupSteps([
			step("s1", "subagent"),
			step("s2", "subagent", { childIds: ["n7"] }),
			step("s3", "subagent"),
		]);

		expect(runs.map((run) => run.title)).toEqual(["subagent s1", "subagent s2", "subagent s3"]);
	});

	it("leaves a failed step alone, and breaks the run around it", () => {
		// A run carries one title and no state. Folded in, the failure is drawn as "3 grep
		// calls" — the count is true and the panel says nothing went wrong.
		const runs = groupSteps([
			step("s1", "grep"),
			step("s2", "grep", { state: "failed" }),
			step("s3", "grep"),
		]);

		expect(runs.map((run) => run.title)).toEqual(["grep s1", "grep s2", "grep s3"]);
		expect(runs[1].steps[0].state).toBe("failed");
	});

	it("leaves a stopped step alone for the same reason a failed one is left alone", () => {
		const runs = groupSteps([
			step("s1", "bash"),
			step("s2", "bash", { state: "aborted" }),
			step("s3", "bash"),
		]);

		expect(runs).toHaveLength(3);
	});

	it("leaves the call that has not come back yet on its own row", () => {
		// The live edge of the window. Folded into the run above it, a call that is hanging is
		// drawn inside a block of calls that finished, and the panel answers "all done" to the
		// only question anyone asks while a run is in flight.
		const runs = groupSteps([
			step("s1", "read"),
			step("s2", "read"),
			step("s3", "read", { state: "running", endedAt: undefined }),
		]);

		expect(runs.map((run) => run.title)).toEqual(["2 read calls", "read s3"]);
	});

	it("says the count for many and the step's own title for one", () => {
		const one = groupSteps([step("s1", "grep"), step("s2", "read")]);
		const many = groupSteps([step("s1", "grep"), step("s2", "grep")]);

		// Never "1 grep calls": a run of one is rendered by its own title, so the count line is
		// only ever built for two or more.
		expect(one.map((run) => run.title)).toEqual(["grep s1", "read s2"]);
		expect(many.map((run) => run.title)).toEqual(["2 grep calls"]);
	});

	it("keeps every step, so the runs are the list itself and not a sample of it", () => {
		const steps = [
			step("s1", "grep"),
			step("s2", "grep"),
			step("s3", "subagent", { childIds: ["n1"] }),
			step("s4", "read", { state: "failed" }),
			step("s5", "read"),
			step("s6", "read"),
		];

		expect(groupSteps(steps).flatMap((run) => run.steps)).toEqual(steps);
	});
});
