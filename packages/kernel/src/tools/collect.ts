/**
 * The `collect` tool: bring one file the machine produced into this conversation's own
 * directory, where `save` writes and the file browser reads.
 *
 * The gap this closes: `run`'s machine and this conversation's own directory are different
 * filesystems, on different computers, and nothing before this tool moved a byte between
 * them. `save` writes text a model composes; it was never a way to move a file a command
 * already wrote to disk, and a plot `run` produced sat on the sandbox until the sandbox was
 * destroyed, unseen by anyone. `run`'s own description used to say this plainly — that
 * nothing but text printed to the screen could ever come back — because it was true. This
 * tool, and `Machine.pull` beneath it, is what makes it no longer true.
 *
 * It is deliberately narrow, not a general bridge between the two filesystems. It copies
 * exactly one named file to exactly one named destination and does nothing else: no listing
 * the machine's disk, no wildcard, no directory copy. An agent that wants to know what is on
 * the machine already has `run` — `ls` answers that — and everything this tool needs to know
 * about the destination is the same question `save` already answers for a write, so it is
 * asked the same way: `splitPath` and `resolveInside`, imported from `save.ts` rather than
 * re-derived, because a containment boundary checked in two places is one that can drift
 * out of step between them.
 *
 * Gated on `canRun && canSave` in `runtime.ts` rather than a permission of its own. An agent
 * that may not run commands has nothing on a machine to collect, and an agent that may not
 * leave files behind has nowhere to put what it collected — `collect` is strictly narrower
 * than the two permissions it already needs, so a third dial here would only be a second
 * name for "both of the other two."
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "typebox";
import type { PullResult } from "../compute/types.ts";
import type { Line } from "../line.ts";
import type { Runtime } from "../runtime.ts";
import { resolveInside, splitPath } from "./save.ts";
import { charge } from "./run.ts";

export interface CollectToolOptions {
	runtime: Runtime;
	/** The line that owns this tool, read late: a line compacts, and the window moves. */
	line: Line;
	/** The directory this tool may write inside, and nowhere else. Absolute — the same root `save` uses. */
	root: string;
	/** Largest file it will keep, in bytes. */
	maxBytes?: number;
}

/**
 * 20 MiB.
 *
 * `save`'s own cap is sized to "the most text a model can emit in one call", which has
 * nothing to do with a file a command already wrote — a checkpoint or a real plot is bigger
 * than any paragraph and is not model output to begin with. This cap exists for a different
 * reason: an agent that collects something enormous fills the conversation's own directory
 * with a file nobody asked to keep, on a disk this process does not own either. Large enough
 * for real plots and small data files; small enough that a mistake costs megabytes, not
 * gigabytes, and is refused — with the bytes already known, since `pull` had to fetch the
 * file to find out — rather than guessed at beforehand.
 */
export const DEFAULT_MAX_PULL_BYTES = 20 * 1024 * 1024;

interface CollectResult {
	content: { type: "text"; text: string }[];
	details: { path: string | null; bytes: number; replaced: boolean };
	isError?: boolean;
}

export function createCollectTool(options: CollectToolOptions) {
	const { runtime, line, root } = options;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_PULL_BYTES;

	return {
		name: "collect",
		label: "Collect",
		description: [
			"Copy one file your machine (see `run`) produced into this conversation's own",
			"directory — the same place `save` writes, and the only place a person looking at",
			"this conversation can see a file at all.",
			"",
			"Use it for anything that is not text you composed yourself: a plot, a checkpoint,",
			"a generated document. Text you wrote belongs in `save` instead, which does not",
			"need a machine and does not cost one.",
			"",
			"`from` is the file's own path on the machine, such as `/work/plot.png`. `path` is",
			"where it lands here, relative to this conversation's directory, such as",
			"`plot.png` or `plots/summary.png`. It cannot start with `/` and cannot climb out",
			`with "..".`,
		].join("\n"),
		promptSnippet: "collect - copy a file your machine produced into this conversation's directory",
		parameters: Type.Object({
			from: Type.String({
				description: "The file's own path on the machine, such as `/work/plot.png`.",
			}),
			path: Type.String({
				description:
					"Where it lands in this conversation's directory, relative to it. For example `plot.png`.",
			}),
		}),
		async execute(_toolCallId: string, params: any): Promise<CollectResult> {
			const from = typeof params?.from === "string" ? params.from.trim() : "";
			if (!from) {
				return errorResult("Give `from`: the file's own path on the machine, such as `/work/plot.png`.");
			}

			const given = typeof params?.path === "string" ? params.path : "";
			const segments = splitPath(given);
			if (typeof segments === "string") return errorResult(segments);
			if (segments.length === 0) {
				// The same rule `save`'s own `readSegments` states: a path that names no file,
				// only the directory it would land in, is not something this tool can write.
				return errorResult(
					`\`${given}\` names no file: it points at the directory itself. Give a name inside it, ` +
						"like `plot.png`.",
				);
			}
			const relative = segments.join("/");

			const machine = await runtime.machine();
			if (!machine) {
				return errorResult(
					"This conversation has no machine, so there is nothing to collect from. `run` a command first.",
				);
			}

			let resolvedTarget: string;
			let replaced: boolean;
			try {
				// The root itself may not exist yet on the first write of a conversation, the
				// same case `save` guards for the same reason.
				fs.mkdirSync(root, { recursive: true });
				const realRoot = fs.realpathSync(root);
				const resolved = resolveInside(realRoot, segments);
				if (!resolved.ok) return errorResult(resolved.message);

				const existing = lstatOrNull(resolved.target);
				if (existing?.isSymbolicLink()) {
					return errorResult(
						`\`${relative}\` is already a symbolic link. Collecting through it would put the ` +
							"file wherever it points, which may be outside this conversation's directory. Use another name.",
					);
				}
				if (existing?.isDirectory()) {
					return errorResult(
						`\`${relative}\` is already a directory, so it cannot be written as a file. Give a file name inside it.`,
					);
				}

				resolvedTarget = resolved.target;
				replaced = existing !== null;
				fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
			} catch (error) {
				return errorResult(
					`Could not prepare \`${relative}\`: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			let result: PullResult;
			try {
				result = await machine.pull(from, resolvedTarget);
			} catch (error) {
				// `pull` is documented to refuse rather than throw, the same as `exec` — this
				// is only the defensive twin of `run`'s own catch, for a provider that breaks
				// that contract or a call that never reaches the machine at all.
				return errorResult(
					`The machine could not be reached: ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				// Charged whether the pull worked or not: a failed transfer still held the
				// machine alive while it was attempted, the same reason `run` charges on
				// every path out of `exec`, success or failure alike.
				charge(runtime, line, machine);
			}

			if (!result.ok) {
				return errorResult(`Could not collect \`${from}\`: ${result.message}`);
			}

			if (result.bytes > maxBytes) {
				// Refused after the fact, not guessed beforehand: the size was not known until
				// the file was already here, so the file that just landed is removed rather
				// than left as a half-refused write nobody asked to keep.
				fs.rmSync(resolvedTarget, { force: true });
				return errorResult(
					`\`${from}\` is ${result.bytes} bytes, over the ${maxBytes}-byte limit this tool collects. ` +
						"Bring back something smaller, or write its numbers out as text with `save` instead.",
				);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: replaced
							? `Replaced \`${relative}\` (${result.bytes} bytes) with \`${from}\` from the machine.`
							: `Collected \`${from}\` as \`${relative}\` (${result.bytes} bytes).`,
					},
				],
				details: { path: relative, bytes: result.bytes, replaced },
			};
		},
	};
}

function lstatOrNull(candidate: string): fs.Stats | null {
	try {
		return fs.lstatSync(candidate);
	} catch {
		return null;
	}
}

function errorResult(message: string): CollectResult {
	return {
		content: [{ type: "text" as const, text: message }],
		details: { path: null, bytes: 0, replaced: false },
		isError: true,
	};
}
