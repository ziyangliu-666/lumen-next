/**
 * Where a sentence goes when a turn may or may not be running.
 *
 * This is the one race in the system that a person can lose money to without seeing
 * anything wrong: two turns started over one message history look, on screen, like one
 * agent working.
 */

import { describe, expect, it } from "vitest";
import { AgentRegistry, Runtime } from "../src/index.ts";
import type { Line, LineSession } from "../src/line.ts";

/**
 * A session that never finishes a turn until it is told to.
 *
 * `prompt` is deliberately slow. The whole question here is what a second caller does while
 * the first is still inside it.
 */
class SlowSession implements LineSession {
	prompted: string[] = [];
	steered: string[] = [];
	followed: string[] = [];
	private release: (() => void) | null = null;

	prompt(text: string): Promise<void> {
		this.prompted.push(text);
		return new Promise<void>((resolve) => {
			this.release = resolve;
		});
	}

	async steer(text: string): Promise<void> {
		this.steered.push(text);
	}

	async followUp(text: string): Promise<void> {
		this.followed.push(text);
	}

	finish(): void {
		this.release?.();
		this.release = null;
	}

	async abort(): Promise<void> {}
	dispose(): void {}
	subscribe(): () => void {
		return () => {};
	}
	async compact(): Promise<{ summary: string }> {
		return { summary: "" };
	}
}

/**
 * A runtime with one line on it, and no model behind it.
 *
 * The line is put in by hand. `openLine` would build a real pi session, which needs
 * credentials and a network, and none of what is being tested here is inside it.
 */
function runtimeWithLine() {
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
	const session = new SlowSession();
	const line: Line = {
		id: "l-1",
		spec: runtime.registry.get("lead"),
		session,
		currentNodeId: node.id,
		depth: 0,
		stop: () => {},
	};
	(runtime as unknown as { linesById: Map<string, Line> }).linesById.set(line.id, line);
	return { runtime, session, line, nodeId: node.id };
}

describe("say", () => {
	it("refuses a second turn while the first is still running", async () => {
		const { runtime, session } = runtimeWithLine();

		const first = runtime.say("l-1", "one");
		await expect(runtime.say("l-1", "two")).rejects.toThrow(/already running a turn/);

		// pi's own `isStreaming` is set several awaits deep inside `prompt`, so a caller that
		// asked pi would have been told the session was idle and would have started a second
		// agent run over one message history. The latch here is set before the turn starts.
		expect(session.prompted).toEqual(["one"]);

		session.finish();
		await first;
	});

	it("lets the next turn through once the first has settled", async () => {
		const { runtime, session } = runtimeWithLine();

		const first = runtime.say("l-1", "one");
		session.finish();
		await first;
		const second = runtime.say("l-1", "two");
		session.finish();
		await second;

		expect(session.prompted).toEqual(["one", "two"]);
	});

	it("releases the latch when a turn fails, so the line is not stuck", async () => {
		const { runtime, line } = runtimeWithLine();
		line.session.prompt = () => Promise.reject(new Error("no credentials"));

		await expect(runtime.say("l-1", "one")).rejects.toThrow("no credentials");

		// A latch held by a failed turn would leave the point permanently unable to be
		// spoken to, and the only sign would be every later sentence being refused.
		expect(line.inFlight).toBeUndefined();
	});
});

describe("deliver", () => {
	it("starts a turn when nothing is running", async () => {
		const { runtime, session } = runtimeWithLine();

		const delivered = runtime.deliver("l-1", "hello", "followUp");
		session.finish();

		expect(await delivered).toBe("turn");
		expect(session.prompted).toEqual(["hello"]);
	});

	it("joins the turn in flight, the way the person chose", async () => {
		const { runtime, session } = runtimeWithLine();

		const turn = runtime.say("l-1", "work");
		expect(await runtime.deliver("l-1", "queued", "followUp")).toBe("followUp");
		expect(await runtime.deliver("l-1", "urgent", "steer")).toBe("steer");

		// Neither opened a turn of its own. Both were absorbed by the one already paid for,
		// which is the whole reason this is not an abort.
		expect(session.prompted).toEqual(["work"]);
		expect(session.followed).toEqual(["queued"]);
		expect(session.steered).toEqual(["urgent"]);

		session.finish();
		await turn;
	});
});

describe("the spend cap", () => {
	it("is off until someone publishes one", () => {
		const { runtime } = runtimeWithLine();

		// A cap that was always on would eventually refuse a person's own delegation, hours
		// after the automatic run it was meant for.
		expect(runtime.overspent()).toBe(false);
		expect(runtime.budget().cap).toBe(Infinity);
	});

	it("reports itself spent once the run passes it", () => {
		const { runtime, nodeId } = runtimeWithLine();
		runtime.spendCap = 1;

		expect(runtime.overspent()).toBe(false);
		runtime.trace.addUsage(nodeId, {
			input: 100,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 120,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 1.2 },
		});

		expect(runtime.overspent()).toBe(true);
		expect(runtime.overspentMessage()).toContain("$1.2000 of its $1.0000 cap");
	});
});
