/**
 * Modal, as one machine per conversation.
 *
 * Modal is here because the alternative to a remote container was a local one, and there
 * is no local one: `docker` is a daemon a researcher has to install, keep running and
 * feed disk. The point of this direction is that nobody configures anything, so the
 * provider is the one that needs no setup on the machine in front of the person.
 *
 * Nothing above this file knows the name. `compute/types.ts` is the whole vocabulary the
 * rest of the engine has, and a lab that wants its own cluster writes a second file beside
 * this one rather than editing anything that calls it.
 *
 * The SDK is imported when the first machine opens, not when this module loads. It builds a
 * gRPC client and reads the operator's Modal profile on construction, and a conversation
 * that never runs a command should do neither. It also puts any failure — no credentials,
 * no network — at the moment an agent asks to run something, where it is a tool result the
 * agent can read, rather than at startup of a feature nobody used.
 */

import * as fs from "node:fs";
import { Meter } from "./meter.ts";
import type { Compute, ExecResult, Machine, PullResult } from "./types.ts";

/**
 * Modal's published price for Sandboxes, in dollars per second, read on 2026-08-24 from
 * https://modal.com/pricing.
 *
 * These are the Sandbox rates and not the standard ones. Modal prints two tables on that
 * page and the Sandbox CPU rate is three times the standard rate. Taking the first table
 * on the page understates a sandbox bill threefold, which is the direction that costs a
 * person money without telling them.
 *
 * A published list is not an invoice. Free credits, committed spend and a plan's included
 * usage all move the real figure, and this cannot see any of them. So what lumen shows is
 * an estimate of list price, and the README says so where a person reads the number.
 */
const CPU_PER_CORE_SECOND = 0.00003942;
const MEMORY_PER_GIB_SECOND = 0.00000667;

/**
 * The machine every conversation gets.
 *
 * Two cores and 4 GiB is enough to clone a repository, install its dependencies and run
 * its tests, which is the work this first version is for. There is no GPU and no way to
 * ask for one. Choosing hardware is meant to be the system's job, and a system that cannot
 * yet read a repository and work out what it needs would only be offering the person a
 * menu — which is the thing being removed.
 */
const CORES = 2;
const MEMORY_GIB = 4;
const IMAGE = "python:3.12-slim";

/**
 * How long a machine may live, and how long it may sit unused.
 *
 * Neither is a setting. Money is the one quantity a person bounds here, and the budget
 * already bounds it; a second dial measured in minutes would be a proxy for the same
 * thing, and it would be possible to set the two so they disagree.
 *
 * An hour is chosen so that a real experiment fits inside one machine, and ten idle
 * minutes so that a conversation somebody walked away from stops costing anything without
 * dying in the middle of a person's thinking.
 */
const LIFE_MS = 60 * 60_000;
const IDLE_MS = 10 * 60_000;

/** What one command gets if it does not ask, and the most it may ask for. */
const DEFAULT_COMMAND_MINUTES = 10;
const MAX_COMMAND_MINUTES = 45;

/**
 * The most output one stream is held in memory for: 256 KiB.
 *
 * This is not the limit the model sees; the tool cuts it down much further for the window.
 * This one stops a command that prints a gigabyte from being held in this process at all.
 */
const MAX_CAPTURE = 256 * 1024;

export interface ModalComputeOptions {
	/**
	 * Names the Modal app, so a person can find these machines in Modal's own dashboard and
	 * kill anything lumen left behind.
	 */
	app?: string;
	/** Names this conversation's sandbox inside that app. */
	label: string;
	/**
	 * This conversation is being resumed from a saved record, not opened for the first time.
	 *
	 * The sandbox this conversation had before is not coming back — see `runtime.ts`'s own
	 * comment on why a pi session can be reopened from disk and a remote container cannot —
	 * so the very next command a resumed agent runs opens a brand new machine with an empty
	 * `/work`, the same as any machine opened after the idle timeout takes one away. Without
	 * this flag that first command would report `restarted: false`: a fresh `ModalMachine`
	 * has never opened a sandbox of its own before, so the ordinary "the old one is gone"
	 * check has nothing to compare against, and an agent that cloned a repository before the
	 * restart would be told nothing changed.
	 */
	resumed?: boolean;
}

export function modalCompute(options: ModalComputeOptions): Compute {
	return new ModalCompute(options);
}

class ModalCompute implements Compute {
	readonly describe = `modal ${IMAGE}, ${CORES} cores, ${MEMORY_GIB} GiB, no GPU`;
	private readonly options: ModalComputeOptions;
	private machine: ModalMachine | null = null;

	constructor(options: ModalComputeOptions) {
		this.options = options;
	}

	async open(): Promise<Machine> {
		if (!this.machine) this.machine = new ModalMachine(this.options);
		return this.machine;
	}

	async close(): Promise<number> {
		if (!this.machine) return 0;
		const owed = await this.machine.stopAndBill();
		this.machine = null;
		return owed;
	}
}

/** Dollars per second for the shape of machine this file opens. */
function perSecond(): number {
	return CORES * CPU_PER_CORE_SECOND + MEMORY_GIB * MEMORY_PER_GIB_SECOND;
}

/**
 * One conversation's machine, which may be several sandboxes over its life.
 *
 * A sandbox dies on its own after `IDLE_MS`, and lumen only finds out when it next tries to
 * use it. So `exec` opens a replacement when the one it had is gone. The replacement is a
 * fresh container with an empty disk, and the result of that command says so in words the
 * agent can act on — a worker that has just lost its checkout must be told, not left to
 * conclude the repository was never there.
 */
class ModalMachine implements Machine {
	private readonly options: ModalComputeOptions;
	private sandbox: any = null;
	private client: any = null;
	private meter: Meter | null = null;
	/** Dollars run up and not yet handed to anybody. */
	private owed = 0;
	/** True when the last command had to open a new sandbox. Read once, by the next result. */
	private restarted = false;
	/**
	 * True until this machine's first boot, when `options.resumed` says the conversation's
	 * own previous machine is gone even though this particular object has never opened one.
	 * `boot()` folds it into `restarted` on that first call and never consults it again.
	 */
	private assumeGone: boolean;
	private opening: Promise<void> | null = null;

	constructor(options: ModalComputeOptions) {
		this.options = options;
		this.assumeGone = options.resumed === true;
	}

	async exec(command: string, options?: { minutes?: number }): Promise<ExecResult> {
		const fresh = await this.ensureUp();
		const minutes = clampMinutes(options?.minutes);
		const limitMs = minutes * 60_000;
		const startedAt = Date.now();
		this.meter?.touch(startedAt);

		// Held outside the reader so a timeout, which throws out of the stream, still leaves
		// whatever the command had already printed. That output is usually the only clue to
		// why it hung.
		let stdout = "";
		let stderr = "";
		try {
			const process = await this.sandbox.exec(["bash", "-lc", command], {
				workdir: "/work",
				timeoutMs: limitMs,
			});
			const drain = async (stream: AsyncIterable<string>, into: (chunk: string) => void) => {
				for await (const chunk of stream) into(chunk);
			};
			await Promise.all([
				drain(process.stdout, (chunk) => {
					if (stdout.length < MAX_CAPTURE) stdout += chunk;
				}),
				drain(process.stderr, (chunk) => {
					if (stderr.length < MAX_CAPTURE) stderr += chunk;
				}),
			]);
			const code = await process.wait();
			const ms = Date.now() - startedAt;
			this.meter?.touch(Date.now());
			return { code, stdout, stderr, ms, ...(fresh ? { restarted: true } : {}) };
		} catch (error) {
			const ms = Date.now() - startedAt;
			this.meter?.touch(Date.now());
			// Told apart by the clock rather than by the message. Modal says "Deadline
			// exceeded" today; a version that words it differently would silently turn every
			// timeout into a machine fault, and the agent would be told its container broke
			// when in fact its command is too slow.
			if (ms >= limitMs) {
				return { code: 124, stdout, stderr, ms, timedOut: true };
			}
			// The sandbox is gone, or the call broke. Drop it so the next command opens
			// another, and say what happened rather than returning an exit code that would
			// read as the command's own.
			await this.discard();
			return {
				code: -1,
				stdout,
				stderr: `${stderr}\nThe machine stopped: ${describeError(error)}`.trim(),
				ms,
			};
		}
	}

	/**
	 * `SandboxFilesystem.copyToLocal` does the actual transfer — Modal's own SDK method for
	 * "one file, off the sandbox, onto this disk" — so there is no byte buffer of the whole
	 * file held in this process at any point, only whatever Modal streams to the path
	 * `collect.ts` already resolved.
	 */
	async pull(remotePath: string, localPath: string): Promise<PullResult> {
		const fresh = await this.ensureUp();
		if (fresh) {
			// The sandbox that ran whatever produced this file is gone; the one that just
			// opened has an empty disk. Saying so beats the confusing error Modal would
			// otherwise give for a path that, from its point of view, never existed.
			return {
				ok: false,
				message:
					"The machine had already gone and a new one just opened with an empty disk, " +
					"so nothing from before survived, including this file.",
			};
		}
		this.meter?.touch(Date.now());
		try {
			await this.sandbox.filesystem.copyToLocal(remotePath, localPath);
			this.meter?.touch(Date.now());
			return { ok: true, bytes: fs.statSync(localPath).size };
		} catch (error) {
			this.meter?.touch(Date.now());
			return { ok: false, message: describeError(error) };
		}
	}

	takeSpend(): number {
		if (this.meter) this.owed += this.meter.take(Date.now());
		const owed = this.owed;
		this.owed = 0;
		return owed;
	}

	async stop(): Promise<void> {
		await this.stopAndBill();
	}

	/** Shut down and hand back everything owed, including the seconds since the last read. */
	async stopAndBill(): Promise<number> {
		if (this.meter) this.owed += this.meter.stop(Date.now());
		const owed = this.owed;
		this.owed = 0;
		await this.discard();
		return owed;
	}

	/** Whether this command is running on a machine that had to be opened just now. */
	private async ensureUp(): Promise<boolean> {
		if (this.sandbox && this.meter && !this.meter.dead(Date.now())) return false;
		// A second delegated worker can call `run` while the first is still opening. Both
		// must end up on the same machine: two sandboxes would each hold half the work, and
		// both would be billed. Both are also told the machine is new, which is true for
		// both of them.
		if (!this.opening) {
			this.opening = this.boot().finally(() => {
				this.opening = null;
			});
		}
		await this.opening;
		return this.restarted;
	}

	private async boot(): Promise<void> {
		// Written before the awaits below, so a second caller waiting on this same promise
		// reads the answer rather than racing the assignment that follows it.
		this.restarted = this.sandbox !== null || this.meter !== null || this.assumeGone;
		this.assumeGone = false;
		if (this.meter) this.owed += this.meter.stop(Date.now());
		await this.discard();

		const { ModalClient } = await import("modal");
		this.client = new ModalClient();
		const app = await this.client.apps.fromName(this.options.app ?? "lumen", {
			createIfMissing: true,
		});
		const image = this.client.images.fromRegistry(IMAGE);
		const startedAt = Date.now();
		this.sandbox = await this.client.sandboxes.create(app, image, {
			cpu: CORES,
			memoryMiB: MEMORY_GIB * 1024,
			timeoutMs: LIFE_MS,
			idleTimeoutMs: IDLE_MS,
			workdir: "/work",
			name: this.options.label,
			tags: { lumen: this.options.label },
		});
		// Measured from before the create call, not after. The container is billed from the
		// moment it starts, and a cold boot is eight seconds of it.
		this.meter = new Meter({
			perSecond: perSecond(),
			idleMs: IDLE_MS,
			lifeMs: LIFE_MS,
			startedAt,
		});
	}

	private async discard(): Promise<void> {
		const sandbox = this.sandbox;
		const client = this.client;
		this.sandbox = null;
		this.client = null;
		this.meter = null;
		// Failures here are ignored on purpose: the usual one is that the sandbox has already
		// died, which is the state being asked for.
		try {
			await sandbox?.terminate();
		} catch {}
		try {
			client?.close();
		} catch {}
	}
}

function clampMinutes(asked: number | undefined): number {
	if (typeof asked !== "number" || !Number.isFinite(asked) || asked <= 0) {
		return DEFAULT_COMMAND_MINUTES;
	}
	return Math.min(asked, MAX_COMMAND_MINUTES);
}

function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
