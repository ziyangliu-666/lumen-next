/**
 * The driver, checked without a model.
 *
 * These are the tests that matter most in this repository, because this is the one piece
 * whose bugs are billed. A loop that retries a failing turn, or that starts a second turn
 * on a session already holding one, spends real money while the screen looks busy and
 * healthy.
 */

import { describe, expect, it } from "vitest";
import { Autopilot, CONTINUE_PROMPT, WRAP_UP_PROMPT, type AutopilotStop } from "../src/autopilot.ts";

/** Lets the event loop run. The driver awaits between turns, so tests have to as well. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Everything the driver needs, and nothing that talks to a model. */
class Host {
	blockDelegation = false;
	/** Every turn it was asked to run, with the state of the block at that moment. */
	said: { lineId: string; text: string; blocked: boolean }[] = [];
	settled = 0;
	spend = 0;
	/** What each turn costs, so a test can walk the run into its budget. */
	perTurn = 0;
	declared: string | undefined;
	fails: string | undefined;
	/** While set, a turn does not end until `release` is called. */
	holding = false;
	private waiting: (() => void)[] = [];

	async settle(): Promise<void> {
		this.settled += 1;
	}

	totalCost(): number {
		return this.spend;
	}

	takeFinish(): string | undefined {
		const declared = this.declared;
		this.declared = undefined;
		return declared;
	}

	async say(lineId: string, text: string): Promise<void> {
		this.said.push({ lineId, text, blocked: this.blockDelegation });
		this.spend += this.perTurn;
		if (this.fails) throw new Error(this.fails);
		if (this.holding) await new Promise<void>((resolve) => this.waiting.push(resolve));
	}

	release(): void {
		for (const resolve of this.waiting.splice(0)) resolve();
	}
}

function drive(host: Host, budget = 10) {
	let settle: (stop: AutopilotStop) => void;
	const stopped = new Promise<AutopilotStop>((resolve) => {
		settle = resolve;
	});
	const auto = new Autopilot({
		host,
		lineId: "l-1",
		budget,
		onStop: (stop) => settle(stop),
	});
	return { auto, stopped };
}

describe("autopilot", () => {
	it("waits for the turn in flight before it drives anything", async () => {
		const host = new Host();
		host.declared = "answered";
		const { auto, stopped } = drive(host);

		auto.start();
		await stopped;

		// The switch is normally pressed while the lead is mid-answer. pi refuses a prompt
		// during a turn rather than queueing it, so a driver that did not wait would fail on
		// its first act.
		expect(host.settled).toBe(1);
	});

	it("stops when the agent declares the work finished", async () => {
		const host = new Host();
		host.declared = "the question is answered";
		const { auto, stopped } = drive(host);

		auto.start();
		const stop = await stopped;

		expect(host.said.map((turn) => turn.text)).toEqual([CONTINUE_PROMPT]);
		expect(stop.reason).toBe("declared");
		expect(stop.note).toBe("the question is answered");
		expect(stop.turns).toBe(1);
		expect(auto.running).toBe(false);
	});

	it("stops on the budget, after one turn that cannot delegate", async () => {
		const host = new Host();
		host.perTurn = 0.6;
		const { auto, stopped } = drive(host, 1);

		auto.start();
		const stop = await stopped;

		// Two ordinary turns take the run past a dollar, then one last turn that writes the
		// report. That turn runs with delegation blocked, which is what stops it starting the
		// work it has just been told there is no money for.
		expect(host.said.map((turn) => turn.text)).toEqual([
			CONTINUE_PROMPT,
			CONTINUE_PROMPT,
			WRAP_UP_PROMPT,
		]);
		expect(host.said.map((turn) => turn.blocked)).toEqual([false, false, true]);
		// Cleared afterwards. Left set, it would refuse every delegation the person made by
		// hand for the rest of the session.
		expect(host.blockDelegation).toBe(false);
		expect(stop.reason).toBe("budget");
		expect(stop.turns).toBe(2);
	});

	it("stops on a failing turn instead of asking again", async () => {
		const host = new Host();
		host.fails = "no credentials";
		const { auto, stopped } = drive(host);

		auto.start();
		const stop = await stopped;

		// A turn fails for reasons that do not improve on repetition. A loop that retried
		// them would spend the whole budget on one error.
		expect(host.said).toHaveLength(1);
		expect(stop.reason).toBe("failed");
		expect(stop.note).toBe("no credentials");
	});

	it("starts one loop however many times the switch is pressed", async () => {
		const host = new Host();
		host.holding = true;
		const { auto } = drive(host);

		auto.start();
		auto.start();
		await tick();

		// Two browser tabs are two views of one run. A second loop against the same line
		// would put two turns into one session, and pi refuses the later one.
		expect(host.said).toHaveLength(1);

		auto.stop();
		host.release();
	});

	it("lets the turn in flight finish, and starts no other", async () => {
		const host = new Host();
		host.holding = true;
		const { auto, stopped } = drive(host);

		auto.start();
		await tick();
		auto.stop();
		host.release();
		await tick();

		// Not an abort. The work already running was paid for, and its answer is worth
		// having whatever the person decided about what comes next.
		expect(host.said).toHaveLength(1);
		expect((await stopped).reason).toBe("you");
		expect(auto.running).toBe(false);
	});

	it("follows the conversation to the line a handoff opened", async () => {
		const host = new Host();
		host.holding = true;
		const { auto } = drive(host);

		auto.start();
		await tick();
		auto.retarget("l-2");
		host.release();
		await tick();

		// A handoff disposes the old session. Without this the driver would prompt a dead
		// line, and every turn from then on would throw.
		expect(host.said.map((turn) => turn.lineId)).toEqual(["l-1", "l-2"]);

		auto.stop();
		host.release();
	});
});
