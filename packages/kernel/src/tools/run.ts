/**
 * The `run` tool: an agent runs a command, on a machine that is not yours.
 *
 * This is the tool the project has been refusing to write. `packages/server/src/agents.ts`
 * says why no agent has `bash`: pi's shell runs here, with the operator's permissions and
 * unfiltered outbound access, and there is no container around it. Every word of that is
 * still true, and none of it is true of this. The command goes to a container that belongs
 * to a provider, cannot see this disk, and is destroyed with the conversation. What made
 * execution unsafe to hand out was where it ran, so that is what moved.
 *
 * It must never be renamed to `bash`, and the reason is mechanical rather than stylistic.
 * `toolSelection` in `runtime.ts` merges custom tool names into the same allowlist pi
 * reads, so a custom tool called `bash` puts the string "bash" into that list — and that
 * string is what switches on pi's own shell, running locally, under a name that looks like
 * this one. `save` carries the identical warning about `write`, and pi does ship both tools
 * under both names.
 *
 * Money: a machine is billed for every second it is up, including the minutes a model
 * spends deciding what to run next. Those dollars are charged to the window that ran the
 * command, through `trace.addUsage`, which is the same door model spend comes through. So
 * the budget covers compute without the driver learning a second number, the panel adds it
 * to the same total, and the README's claim that the budget is the only number stays true.
 */

import { Type } from "typebox";
import type { Machine } from "../compute/types.ts";
import type { Line } from "../line.ts";
import type { Runtime } from "../runtime.ts";
import { emptyUsage } from "../trace/types.ts";

export interface RunToolOptions {
	runtime: Runtime;
	/** The line that owns this tool, read late: a line compacts, and the window moves. */
	line: Line;
}

/**
 * The most of one stream a model is shown: 4000 characters, about 1000 tokens.
 *
 * The middle is what gets cut, never the end. A build prints thousands of lines of
 * progress and then the one line that says what went wrong, and a cut that kept the head
 * would keep the progress and drop the error.
 */
const MAX_STREAM_CHARS = 4000;

export function createRunTool(options: RunToolOptions) {
	const { runtime, line } = options;

	return {
		name: "run",
		label: "Run",
		description: [
			"Run a shell command on a machine of your own, and read what it prints.",
			"",
			"It is a Linux container somewhere else. It is not the computer this conversation",
			"is running on, and it cannot see any of its files. It starts with Python, a shell",
			"and an empty disk, and it can reach the internet, so install what you need and",
			"clone what you need.",
			"",
			"Work in `/work`. Files stay there between commands, so one command can clone a",
			"repository and the next can run it.",
			"",
			"The machine belongs to this conversation and not to you. Another agent may have",
			"already cloned what you are about to clone, so look before you fetch.",
			"",
			"Use it to settle a question rather than to describe one. Running a test tells you",
			"what the test does; reading it tells you what it appears to do.",
			"",
			"A command is killed after ten minutes unless you ask for longer with `minutes`.",
		].join("\n"),
		promptSnippet: "run - run a shell command on this conversation's machine",
		parameters: Type.Object({
			command: Type.String({
				description:
					"The command, run through bash in `/work`. Pipes, `&&` and multiple lines all work.",
			}),
			minutes: Type.Optional(
				Type.Number({
					description:
						"How long this command may take before it is killed. Ten by default, forty-five at most. Ask for more only when you expect it: a command that is killed still costs what it spent.",
				}),
			),
		}),
		async execute(_toolCallId: string, params: any) {
			// The same check the delegation tool makes, for the same reason. A machine spends
			// money by existing, so a run that has passed its cap must not start another
			// command any more than it may open another window.
			if (runtime.overspent()) {
				return errorResult(
					`${capitalise(runtime.overspentMessage())}. Write down what you already have ` +
						"and do not run anything else.",
				);
			}

			const command = String(params?.command ?? "").trim();
			if (!command) {
				return errorResult("Give `command`: the shell command to run.");
			}

			const machine = await runtime.machine();
			if (!machine) {
				return errorResult(
					"This conversation has no machine, so nothing can be run. Answer from what you " +
						"can read instead, and say that you could not run anything.",
				);
			}

			const minutes = typeof params?.minutes === "number" ? params.minutes : undefined;
			let result;
			try {
				result = await machine.exec(command, minutes === undefined ? undefined : { minutes });
			} catch (error) {
				// Nothing reached the machine, so nothing ran and there is nothing to charge.
				return errorResult(
					`The machine could not be reached: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				// In `finally` because the seconds were spent whether or not the command
				// worked. `line.currentNodeId` is read late as well: it is where this window
				// is now, which is not where it was when the tool was built.
				charge(runtime, line, machine);
			}

			return {
				content: [{ type: "text" as const, text: render(result) }],
				details: {
					code: result.code,
					ms: result.ms,
					timedOut: result.timedOut === true,
					restarted: result.restarted === true,
				},
				// An exit code the agent must not read past. A command that failed is not a
				// step that succeeded, and the row on screen should not say it was.
				isError: result.code !== 0,
			};
		},
	};
}

/**
 * Move what the machine has run up into this window's own spend.
 *
 * Charged to the window that ran the command, not to the root. A person clicking a point
 * asks what that window cost, and a machine's seconds were spent on that window's work.
 */
function charge(runtime: Runtime, line: Line, machine: Machine): void {
	const dollars = machine.takeSpend();
	if (dollars <= 0) return;
	const usage = emptyUsage();
	usage.cost.total = dollars;
	runtime.trace.addUsage(line.currentNodeId, usage);
}

function render(result: {
	code: number;
	stdout: string;
	stderr: string;
	ms: number;
	timedOut?: boolean;
	restarted?: boolean;
}): string {
	const lines: string[] = [];
	if (result.restarted) {
		lines.push(
			"The previous machine had gone, so this ran on a new one with an empty disk. " +
				"Anything cloned or installed before this is no longer there.",
			"",
		);
	}
	if (result.timedOut) {
		lines.push(
			`Killed after ${seconds(result.ms)}: it ran past its limit. Whatever it printed ` +
				"first is below.",
			"",
		);
	} else {
		lines.push(`exit ${result.code} in ${seconds(result.ms)}`, "");
	}
	const stdout = cut(result.stdout);
	const stderr = cut(result.stderr);
	if (stdout) lines.push("stdout:", stdout);
	// Both streams matter and they must not run together. A command that printed progress
	// to one and its error to the other reads as one confused block without the gap.
	if (stderr) {
		if (stdout) lines.push("");
		lines.push("stderr:", stderr);
	}
	if (!stdout && !stderr) lines.push("It printed nothing.");
	return lines.join("\n").trim();
}

/** Keep the start and the end, and say how much went. */
function cut(text: string): string {
	const trimmed = text.trimEnd();
	if (trimmed.length <= MAX_STREAM_CHARS) return trimmed;
	const head = Math.floor(MAX_STREAM_CHARS / 3);
	const tail = MAX_STREAM_CHARS - head;
	const dropped = trimmed.length - MAX_STREAM_CHARS;
	return `${trimmed.slice(0, head)}\n\n… ${dropped} characters cut from the middle …\n\n${trimmed.slice(-tail)}`;
}

function seconds(ms: number): string {
	return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function errorResult(text: string) {
	return {
		content: [{ type: "text" as const, text }],
		details: { code: null, ms: 0, timedOut: false, restarted: false },
		isError: true,
	};
}
