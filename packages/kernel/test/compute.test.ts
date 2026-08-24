/**
 * What a machine costs, and what the `run` tool does with that figure.
 *
 * These are the two failures that cost money without saying anything. A meter that
 * under-bills makes the budget a number the run quietly walks past. A tool that forgets to
 * charge what the meter says makes every point on screen look cheaper than it was.
 *
 * Nothing here reaches Modal. The provider is one file behind an interface precisely so
 * that the arithmetic can be checked against a clock the test owns.
 */

import { describe, expect, it } from "vitest";
import { Meter } from "../src/compute/meter.ts";
import { createRunTool } from "../src/tools/run.ts";
import type { Machine } from "../src/compute/types.ts";
import { emptyUsage, type Usage } from "../src/trace/types.ts";

const MINUTE = 60_000;

describe("Meter", () => {
	it("bills the seconds the machine is up, not the seconds a command runs", () => {
		// The case the whole class exists for. One command at the start, one four minutes
		// later, and the machine was up for all of it while a model was thinking.
		const meter = new Meter({ perSecond: 0.001, idleMs: 10 * MINUTE, lifeMs: 60 * MINUTE, startedAt: 0 });
		meter.touch(1_000);
		expect(meter.take(1_000)).toBeCloseTo(1 * 0.001, 10);
		meter.touch(5 * MINUTE);
		expect(meter.take(5 * MINUTE)).toBeCloseTo((5 * 60 - 1) * 0.001, 10);
	});

	it("charges each second once", () => {
		const meter = new Meter({ perSecond: 0.001, idleMs: 10 * MINUTE, lifeMs: 60 * MINUTE, startedAt: 0 });
		expect(meter.take(10_000)).toBeCloseTo(10 * 0.001, 10);
		// Read again with no time passed. A meter that returned a running total instead of
		// what is owed would charge the same ten seconds to every window that asked.
		expect(meter.take(10_000)).toBe(0);
	});

	it("stops billing when the machine dies of being idle", () => {
		// The direction that would invent money. Nothing touches it for four hours; the
		// provider killed it after ten minutes, and the bill must stop where the machine did.
		const meter = new Meter({ perSecond: 0.001, idleMs: 10 * MINUTE, lifeMs: 60 * MINUTE, startedAt: 0 });
		expect(meter.take(4 * 60 * MINUTE)).toBeCloseTo(10 * 60 * 0.001, 10);
		expect(meter.dead(4 * 60 * MINUTE)).toBe(true);
	});

	it("never bills past the machine's own life limit", () => {
		const meter = new Meter({ perSecond: 0.001, idleMs: 10 * MINUTE, lifeMs: 30 * MINUTE, startedAt: 0 });
		// Busy the whole time, so the idle clock never expires. The life limit is what ends it.
		for (let at = MINUTE; at <= 60 * MINUTE; at += MINUTE) meter.touch(at);
		expect(meter.take(60 * MINUTE)).toBeCloseTo(30 * 60 * 0.001, 10);
	});

	it("charges nothing after it is stopped", () => {
		const meter = new Meter({ perSecond: 0.001, idleMs: 10 * MINUTE, lifeMs: 60 * MINUTE, startedAt: 0 });
		expect(meter.stop(2_000)).toBeCloseTo(2 * 0.001, 10);
		meter.touch(60 * MINUTE);
		expect(meter.take(60 * MINUTE)).toBe(0);
	});
});

/** A machine that runs nothing and charges whatever the test says. */
function fakeMachine(over: Partial<Machine> & { spend?: number } = {}): Machine & { commands: string[] } {
	const commands: string[] = [];
	let spend = over.spend ?? 0;
	return {
		commands,
		async exec(command: string) {
			commands.push(command);
			return { code: 0, stdout: "ok", stderr: "", ms: 12 };
		},
		takeSpend() {
			const owed = spend;
			spend = 0;
			return owed;
		},
		async stop() {},
		...over,
	};
}

/** Just enough Runtime for the tool: a cap, a machine, and somewhere to put the money. */
function fakeRuntime(machine: Machine | null, charged: Usage[]) {
	return {
		overspent: () => false,
		overspentMessage: () => "this run has spent it all",
		machine: async () => machine,
		trace: {
			addUsage(_nodeId: string, usage: Usage) {
				charged.push(usage);
			},
		},
	} as any;
}

const line = { currentNodeId: "n1" } as any;

describe("run tool", () => {
	it("charges what the machine ran up to the window that ran the command", async () => {
		const charged: Usage[] = [];
		const machine = fakeMachine({ spend: 0.0731 });
		const tool = createRunTool({ runtime: fakeRuntime(machine, charged), line });

		await tool.execute("c1", { command: "pytest -q" });

		expect(machine.commands).toEqual(["pytest -q"]);
		expect(charged).toHaveLength(1);
		expect(charged[0].cost.total).toBeCloseTo(0.0731, 10);
		// Dollars, and no tokens. A machine's seconds are not a model's words, and a count
		// invented here would show up as tokens nothing generated.
		expect(charged[0].totalTokens).toBe(0);
	});

	it("charges the seconds even when the command fails", async () => {
		// The failure worth pinning: the money was spent whether or not the command worked,
		// so an early return on the error path is a run that spends unrecorded.
		const charged: Usage[] = [];
		const machine = fakeMachine({
			spend: 0.02,
			async exec() {
				return { code: 1, stdout: "", stderr: "boom", ms: 5 };
			},
		});
		const tool = createRunTool({ runtime: fakeRuntime(machine, charged), line });

		const result: any = await tool.execute("c1", { command: "false" });

		expect(result.isError).toBe(true);
		expect(charged[0].cost.total).toBeCloseTo(0.02, 10);
	});

	it("charges nothing when there is no machine, and says so in words", async () => {
		const charged: Usage[] = [];
		const tool = createRunTool({ runtime: fakeRuntime(null, charged), line });

		const result: any = await tool.execute("c1", { command: "pytest" });

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("no machine");
		expect(charged).toHaveLength(0);
	});

	it("refuses to run anything once the run has spent its cap", async () => {
		// The same rule the delegation tool follows. A machine spends by existing, so a run
		// that is out of money must not start a command any more than it may open a window.
		const charged: Usage[] = [];
		const machine = fakeMachine({ spend: 5 });
		const runtime = fakeRuntime(machine, charged);
		runtime.overspent = () => true;
		const tool = createRunTool({ runtime, line });

		const result: any = await tool.execute("c1", { command: "pytest" });

		expect(result.isError).toBe(true);
		expect(machine.commands).toHaveLength(0);
	});

	it("tells the agent when its machine was replaced, so it does not trust an empty disk", async () => {
		const machine = fakeMachine({
			async exec() {
				return { code: 0, stdout: "", stderr: "", ms: 3, restarted: true };
			},
		});
		const tool = createRunTool({ runtime: fakeRuntime(machine, []), line });

		const result: any = await tool.execute("c1", { command: "ls" });

		expect(result.content[0].text).toContain("empty disk");
		expect(result.details.restarted).toBe(true);
	});

	it("keeps the end of a long output, because that is where the error is", async () => {
		const machine = fakeMachine({
			async exec() {
				const noise = "progress\n".repeat(4000);
				return { code: 1, stdout: `${noise}THE ACTUAL ERROR`, stderr: "", ms: 3 };
			},
		});
		const tool = createRunTool({ runtime: fakeRuntime(machine, []), line });

		const result: any = await tool.execute("c1", { command: "make" });

		expect(result.content[0].text).toContain("THE ACTUAL ERROR");
		expect(result.content[0].text).toContain("cut from the middle");
	});
});

describe("emptyUsage as a carrier for dollars", () => {
	it("adds nothing but money", () => {
		// Pinning the shape the tool relies on. If `emptyUsage` ever grew a non-zero field,
		// every command run would quietly add tokens nobody spent.
		const usage = emptyUsage();
		usage.cost.total = 0.5;
		expect(usage.totalTokens).toBe(0);
		expect(usage.input).toBe(0);
		expect(usage.cost.input).toBe(0);
	});
});
