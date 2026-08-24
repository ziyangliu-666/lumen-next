/**
 * What a machine costs while it is up.
 *
 * The unit a provider bills is the second a container exists, not the second a command
 * runs. Between two commands the machine sits there while a model reads the last result
 * and writes the next one, and that wait is billed. So the meter runs on wall-clock from
 * the moment the machine opens, and a run that thinks for four minutes between two
 * one-second commands is charged for four minutes.
 *
 * Charging only for commands was the obvious alternative and it understates by however
 * long the models take, which on a slow question is most of the bill. A number that is
 * wrong in the direction of "cheaper than it was" is the one a person cannot act on.
 *
 * The other direction is guarded by `dies`. A machine is killed by its provider after it
 * has been idle a while, and lumen does not find out until it next tries to use it. Billing
 * plain wall-clock would then charge for hours in which nothing existed. So the meter knows
 * when the machine dies if nothing touches it, and never bills past that point.
 *
 * One meter measures one machine. When a machine is replaced, its meter is stopped and a
 * new one starts, so a fresh machine's life is never measured from the dead one's start.
 *
 * Every time is a millisecond epoch, passed in rather than read here. The tests drive this
 * with a clock they own, which is the only way to check what a four-hour idle costs.
 */

export interface MeterOptions {
	/** Dollars per second while the machine is up. */
	perSecond: number;
	/** How long the provider lets it sit unused before killing it. */
	idleMs: number;
	/** The longest it may live, however busy it is. */
	lifeMs: number;
	startedAt: number;
}

export class Meter {
	private readonly perSecond: number;
	private readonly idleMs: number;
	/** The last instant this machine can be alive: its own life limit. */
	private readonly endsAt: number;
	/** Everything up to here is already in someone's bill. */
	private billedTo: number;
	/** When it dies if nothing else happens. Moves forward on every command. */
	private dies: number;
	private stopped = false;

	constructor(options: MeterOptions) {
		this.perSecond = options.perSecond;
		this.idleMs = options.idleMs;
		this.endsAt = options.startedAt + options.lifeMs;
		this.billedTo = options.startedAt;
		this.dies = Math.min(options.startedAt + options.idleMs, this.endsAt);
	}

	/** A command ran. The machine is alive at `at`, and its idle clock starts again. */
	touch(at: number): void {
		if (this.stopped) return;
		this.dies = Math.min(at + this.idleMs, this.endsAt);
	}

	/**
	 * Dollars owed since the last read. Reading clears them.
	 *
	 * Bills up to now, or up to the moment the machine dies by itself, whichever is
	 * earlier.
	 */
	take(at: number): number {
		if (this.stopped) return 0;
		const until = Math.min(at, this.dies);
		const seconds = Math.max(0, until - this.billedTo) / 1000;
		this.billedTo = Math.max(this.billedTo, until);
		return seconds * this.perSecond;
	}

	/** Take the last of it and stop. Everything after this is free, because it is gone. */
	stop(at: number): number {
		const owed = this.take(at);
		this.stopped = true;
		return owed;
	}

	/** When this machine dies if nothing touches it again. */
	diesAt(): number {
		return this.dies;
	}

	/** Whether the machine is already gone at `at`, so a caller knows to open another. */
	dead(at: number): boolean {
		return this.stopped || at > this.dies;
	}
}
