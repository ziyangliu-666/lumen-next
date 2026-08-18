/**
 * The driver: it asks one line to carry on until the work is done or the money is gone.
 *
 * Without it, a lead advances exactly one turn per sentence a person types, so research
 * that takes ten rounds of looking takes ten sentences. With it, the person states the
 * question once and the lead delegates, reads what came back, decides what is still
 * missing, and delegates again.
 *
 * It adds no concept to the graph. Every turn it drives is an ordinary turn on an ordinary
 * line: the window fills, pi compacts it, `Runtime.rotate` opens the successor, and the run
 * draws itself as a chain of points with its delegations hanging underneath. The one rule
 * already covers this, and a driver that invented a node kind of its own would be drawing a
 * second picture of the same machine.
 *
 * Two things stop it, and they are different in kind:
 *
 *   the agent says so   `finish`, a declaration. It is the good ending, and it is the one
 *                       the model controls.
 *   the budget          a number, checked by this loop before every turn. It holds when the
 *                       prompt does not, which is the only reason to have it.
 *
 * There is deliberately no turn cap. Turns are a proxy for cost, cost can be measured
 * directly, and a second limit on the same thing is a second number a person has to reason
 * about before they dare turn this on.
 */

/**
 * What the driver needs from the world.
 *
 * Narrow on purpose: it is `Runtime` in production and a stub in the tests, and the whole
 * value of testing this piece is that the failure modes cost money.
 */
export interface AutopilotHost {
	/** Send a turn and resolve when it settles. */
	say(lineId: string, text: string): Promise<void>;
	/** Resolve once this line has no turn in flight. */
	settle(lineId: string): Promise<void>;
	/** The agent's declaration that it is done, read once and cleared. */
	takeFinish(lineId: string): string | undefined;
	/** Everything the run has spent so far, in dollars. */
	totalCost(): number;
	/** While set, the delegation tool refuses. */
	blockDelegation: boolean;
}

export interface AutopilotStop {
	/**
	 * Why it ended. Four, because a person reads them differently: `declared` is work
	 * finished, `budget` is work cut short, `you` is a decision, and `failed` is a fault.
	 */
	reason: "declared" | "budget" | "you" | "failed";
	turns: number;
	spent: number;
	/** The agent's own words for `declared`, the error text for `failed`. */
	note?: string;
}

export interface AutopilotOptions {
	host: AutopilotHost;
	lineId: string;
	/** Dollars. The run stops before the turn that would take it past this. */
	budget: number;
	onTurn?: (turn: number) => void;
	onStop?: (stop: AutopilotStop) => void;
}

/**
 * Sent at the start of every automatic turn.
 *
 * It says out loud that nobody typed. Without that, the model reads a bare "continue" as a
 * person asking for more and writes a reply to them, which is a turn spent addressing an
 * empty chair.
 */
export const CONTINUE_PROMPT = [
	"Nobody typed this. You are working on your own, so take the next step yourself.",
	"",
	"Look at what came back. If the question you were given is answered, or you have",
	"established that it cannot be answered with what you can reach, call `finish`.",
	"Otherwise delegate the specific look-ups that are still missing, then say what you",
	"now know.",
	"",
	"Do not repeat a look-up that has already been done, and do not report anything no",
	"worker actually found.",
].join("\n");

/**
 * The one turn after the budget is gone.
 *
 * The alternative was stopping dead, which loses the run's own account of itself: the
 * findings are scattered across a dozen windows and the person has to assemble them by
 * clicking. This turn costs one model call and cannot start an agent, because
 * `blockDelegation` is set around it.
 */
export const WRAP_UP_PROMPT = [
	"The budget for this run is spent. You cannot start any more work.",
	"",
	"Write what you found and what is still missing. Say which parts are settled and",
	"which are guesses. Do not describe work that was not done.",
].join("\n");

export class Autopilot {
	private readonly options: AutopilotOptions;
	private lineId: string;
	private active = false;
	private turn = 0;
	/** The loop itself, so `start` can tell "already running" from "idle". */
	private loop: Promise<void> | null = null;

	constructor(options: AutopilotOptions) {
		this.options = options;
		this.lineId = options.lineId;
	}

	get running(): boolean {
		return this.active;
	}

	get turns(): number {
		return this.turn;
	}

	/**
	 * Begin driving, or do nothing if it is already driving.
	 *
	 * Idempotent because two browser tabs are two views of one run, and the second person to
	 * press the switch must not start a second loop against the same line — that would put
	 * two turns into one session and pi would refuse the later one.
	 */
	start(): void {
		if (this.active) return;
		this.active = true;
		this.turn = 0;
		this.loop = this.run().finally(() => {
			this.loop = null;
		});
	}

	/**
	 * Stop driving. The turn in flight is left to finish.
	 *
	 * Not an abort. The work already running has been paid for, and its answer is worth
	 * having whatever the person decided about what comes next. Someone who wants the
	 * current turn killed as well presses stop, which aborts the line separately.
	 */
	stop(reason: AutopilotStop["reason"] = "you", note?: string): void {
		if (!this.active) return;
		this.active = false;
		this.options.onStop?.({
			reason,
			turns: this.turn,
			spent: this.options.host.totalCost(),
			note,
		});
	}

	/**
	 * Follow the conversation to a different line.
	 *
	 * A handoff ends this line and opens another one holding the same conversation. Without
	 * this the driver would keep prompting a session that has been disposed, and every turn
	 * would throw.
	 */
	retarget(lineId: string): void {
		this.lineId = lineId;
	}

	private async run(): Promise<void> {
		const { host, budget } = this.options;

		// Wait for whatever is running before the first turn. The switch is usually pressed
		// while the lead is mid-answer, and pi refuses a prompt during a turn rather than
		// queueing it — so without this the loop's first act would be to throw.
		try {
			await host.settle(this.lineId);
		} catch (cause) {
			this.stop("failed", messageOf(cause));
			return;
		}

		while (this.active) {
			if (host.totalCost() >= budget) {
				await this.wrapUp();
				this.stop("budget");
				return;
			}

			this.turn += 1;
			this.options.onTurn?.(this.turn);

			try {
				await host.say(this.lineId, CONTINUE_PROMPT);
			} catch (cause) {
				// Stop rather than try again. A turn fails for reasons that do not improve on
				// repetition — no credentials, a disposed session, a model that is refusing —
				// and a loop that retries them spends the entire budget on the same error.
				this.stop("failed", messageOf(cause));
				return;
			}

			// Read after the turn, not during it. `finish` is a declaration about the work as
			// a whole, and an agent that calls it then keeps working has not finished yet.
			const declared = host.takeFinish(this.lineId);
			if (declared !== undefined) {
				this.stop("declared", declared);
				return;
			}

			// The person may have pressed stop while that turn ran. Checked here rather than
			// only in the `while`, so the state is read after every await rather than before.
			if (!this.active) return;
		}
	}

	/**
	 * One last turn, which can write but cannot spend.
	 *
	 * Its cost is not checked against the budget, and that is not an oversight: the budget is
	 * already gone by the time this runs, so testing it would only ever refuse. What holds
	 * instead is `blockDelegation` — this turn is one model call and can start nothing.
	 */
	private async wrapUp(): Promise<void> {
		const { host } = this.options;
		host.blockDelegation = true;
		try {
			await host.say(this.lineId, WRAP_UP_PROMPT);
		} catch {
			// The report is the last thing the run does. Losing it is worth a shrug, because
			// the findings are still on the graph where the person can read them, and the
			// reason the loop is ending has already been decided by the caller.
		} finally {
			host.blockDelegation = false;
		}
	}
}

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
