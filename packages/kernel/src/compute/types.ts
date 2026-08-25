/**
 * Where code runs.
 *
 * Until now an agent could read a repository, search the web and write a paragraph, and
 * could not run one line of it. So every question that ends in "does this actually work"
 * ended instead in a description of what would probably happen. A worker reported what a
 * test file appeared to assert; nothing ran the test.
 *
 * This is the seam that ends that, and it is deliberately not `bash`. pi ships a `bash`
 * tool that runs on the operator's own machine, with the operator's own permissions and
 * unfiltered outbound access. `packages/server/src/agents.ts` records why it is not handed
 * out. A machine reached through this interface has neither property: it is a container
 * somewhere else, it cannot see the operator's disk, and it dies when the conversation
 * does. Execution became safe to give out by moving it off the machine, not by asking an
 * agent nicely.
 *
 * There is one implementation. It is still an interface, because the thing behind it is a
 * bill: a lab with its own cluster, a person with an AWS account and a person with none
 * are three different providers, and none of them should change what the agents are told.
 * Nothing here names Modal, and nothing here is aware that a GPU exists.
 *
 * The methods are the ones that have a caller. There is still no `push`: nothing here needs
 * to put a local file onto the machine, only take one off it, so that half of the interface
 * stays unpromised until something actually calls it.
 *
 * `pull` is the one exception, and it exists because a real gap sat behind its absence. A
 * plot `run` produced had no way back into this conversation's own directory — `save` writes
 * text a model composed, not bytes a command already wrote to a file, and the two machines
 * involved (the sandbox and whatever hosts this process) share no filesystem. `pull` is
 * `tools/collect.ts`'s whole reason to exist: it copies one file, named by its path on the
 * machine, to a path on this process's own disk that the caller — always `collect`, always
 * after `resolveInside` has vetted it — already decided is safe to write.
 */

/** What one command did. Always all four fields: a command that failed still ran. */
export interface ExecResult {
	/** Process exit status. Zero is success, and nothing else is. */
	code: number;
	stdout: string;
	stderr: string;
	/** Wall-clock milliseconds. The agent is told this: it is how it learns what is slow. */
	ms: number;
	/** True when the command was killed for running past its limit rather than exiting. */
	timedOut?: boolean;
	/**
	 * True when this command ran on a machine opened for it, because the previous one had
	 * gone. The disk it starts on is empty, and whoever asked has to be told: a worker that
	 * has just lost its checkout will otherwise conclude the repository was never cloned.
	 */
	restarted?: boolean;
}

/** Whether `pull` reached the file, and how big it turned out to be, or why not. */
export type PullResult = { ok: true; bytes: number } | { ok: false; message: string };

/** A machine that is up, with a filesystem that persists between commands. */
export interface Machine {
	/**
	 * Run one command through a shell and wait for it to exit.
	 *
	 * `minutes` is a ceiling on this command, not on the machine. The command is killed at
	 * it and the result says so, which an agent can read and act on. A command with no
	 * ceiling is a turn that never ends, and nothing on screen would say why.
	 */
	exec(command: string, options?: { minutes?: number }): Promise<ExecResult>;
	/**
	 * Copy one file off the machine and onto this process's own disk.
	 *
	 * `remotePath` is the file's own path on the machine — absolute, since a command may
	 * have written it anywhere under `/work` or beyond. `localPath` is absolute here too,
	 * and this trusts it completely: it is `tools/collect.ts`'s job, not this method's, to
	 * make sure that path is safe to write to before calling this at all — the same split
	 * `exec` already keeps with the command it is handed, and `save`'s own doc comment keeps
	 * for the same reason: a boundary checked in two places is a boundary that can drift.
	 *
	 * Refuses rather than throws when the remote file is missing, is a directory, or the
	 * machine has been replaced since anything last wrote to it — an agent's next turn reads
	 * `message` and can act on it, where a thrown error would only end the turn.
	 */
	pull(remotePath: string, localPath: string): Promise<PullResult>;
	/**
	 * Dollars this machine has run up since the last call. Reading clears the total.
	 *
	 * Read-and-clear rather than a running total, because every dollar read here is charged
	 * to the window that read it. A total read twice would be charged twice.
	 */
	takeSpend(): number;
	/** Shut it down. The filesystem goes with it. */
	stop(): Promise<void>;
}

/**
 * A provider. It opens at most one machine, and that machine belongs to the conversation.
 *
 * One per conversation rather than one per agent, for the reason the conversation already
 * has one directory: one worker clones the repository and a second runs the tests against
 * that same checkout. Agents with a machine each would each start from an empty disk, and
 * the work of the first would be invisible to the second.
 */
export interface Compute {
	/** For the interface and the logs. Say what a person is being billed for. */
	readonly describe: string;
	/**
	 * Hand back this conversation's machine.
	 *
	 * Nothing starts here. A container is billed from the second it exists, so the first
	 * command is what starts one, and a conversation that asks for a machine and then
	 * decides it does not need one is charged for nothing.
	 */
	open(): Promise<Machine>;
	/** Shut down whatever is up, and hand back the last dollars it ran up. */
	close(): Promise<number>;
}
