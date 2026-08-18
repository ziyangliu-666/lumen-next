/**
 * The `save` tool: an agent writes a file, and it lands inside this conversation's directory
 * or nowhere.
 *
 * Until now no agent could write anything, and the README states that as a security property.
 * It becomes a narrower one. Each conversation owns a directory, and agents may leave
 * findings, notes, a report, and material one agent writes for another to read.
 *
 * pi already ships a `write` tool, and this is deliberately not it. pi resolves a path with
 * `resolveToCwd`, whose own documentation says it "handles ~ expansion and absolute paths",
 * so an absolute path leaves the working directory entirely. pi's `write` pointed at a
 * session directory is therefore not confined to that directory: it writes anywhere the
 * operator can. The rule this repository states in `packages/server/src/agents.ts` is that a
 * tool allowlist is a property of the process, and is never asked for in a prompt. A boundary
 * that exists only in a system prompt is not a boundary. So this tool resolves its own paths,
 * and the root is enforced here, in the process.
 *
 * It registers as `save`, and it must never be renamed to `write`. `toolSelection` in
 * `runtime.ts` merges custom tool names into the same allowlist pi reads. A custom tool named
 * `write` would put the string "write" into that list, and that string is what enables pi's
 * built-in writer: the allowlist would quietly turn on the unrooted tool, under a name that
 * looks like ours. That is the same class of bug the comment in `toolSelection` already
 * records, where a name left out of the list dropped a tool without a word.
 *
 * What this can and cannot promise about symlinks is written above `resolveInside`. Read it
 * before trusting the boundary: it is a check, not a lock.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "typebox";

export interface SaveToolOptions {
	/** The directory this tool may write inside, and nowhere else. Absolute. */
	root: string;
	/** Largest file it will write, in bytes. */
	maxBytes?: number;
}

/**
 * 256 KiB, which is roughly the most text a model can emit in one turn.
 *
 * So one honest write never reaches it, and the case it does stop is the one worth stopping:
 * an agent that loops, rewriting a file that grows each pass. That agent should meet a wall
 * in this process, where the refusal is a tool result it can read and act on. The wall the
 * filesystem gives it instead is a full disk, shared with everything else on the machine.
 */
const DEFAULT_MAX_BYTES = 256 * 1024;

/**
 * One shape for both outcomes, written down rather than inferred.
 *
 * A refusal and a write differ by a flag, not by their type. Inferred, they would be a union
 * with `isError` on only one side, and a caller that asked whether the write succeeded would
 * not compile. `details` is what pi's result type requires, and it carries the same three
 * facts either way: a refusal wrote nothing, so its path is null and its count is zero.
 */
interface SaveResult {
	content: { type: "text"; text: string }[];
	details: { path: string | null; bytes: number; replaced: boolean };
	isError?: boolean;
}

export function createSaveTool(options: SaveToolOptions) {
	const { root } = options;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	return {
		name: "save",
		label: "Save",
		description: [
			"Write a file into this conversation's directory, which is the only place you can",
			"write.",
			"",
			"Use it for anything that must outlive your context window: findings, notes, a",
			"report, or material another agent is meant to read. Give a path relative to that",
			"directory, such as `notes/findings.md`. Directories on the way are created for you.",
			"",
			"A file that is already there is overwritten and the result says so. If somebody",
			"else may have written it, read it before you replace it.",
		].join("\n"),
		promptSnippet: "save - write a file into this conversation's directory",
		parameters: Type.Object({
			path: Type.String({
				description:
					"Where to write, relative to this conversation's directory. For example `notes/findings.md`. It cannot start with `/` and cannot climb out with `..`.",
			}),
			text: Type.String({
				description:
					"The whole contents of the file. It replaces what is there; there is no append.",
			}),
		}),
		async execute(_toolCallId: string, params: any): Promise<SaveResult> {
			if (typeof params?.text !== "string") {
				return errorResult(
					"Give `text` as a string: the whole contents of the file you want to write.",
				);
			}
			const text = params.text;
			const given = typeof params?.path === "string" ? params.path : "";

			const named = readSegments(given);
			if (typeof named === "string") return errorResult(named);
			const relative = named.join("/");

			// Counted in bytes, not characters. A model that writes prose in Chinese spends
			// three bytes per character, and a cap read as a character count would let that
			// file be three times the size the operator agreed to.
			const bytes = Buffer.byteLength(text, "utf8");
			if (bytes > maxBytes) {
				return errorResult(
					`\`${relative}\` would be ${bytes} bytes, over the limit of ${maxBytes} bytes for one ` +
						"file. Cut it down, or split the material across several files. The limit is " +
						"enforced by this process and does not move.",
				);
			}

			try {
				// The root itself may not exist yet on the first write of a conversation, and
				// `realpathSync` needs a real directory to answer about.
				fs.mkdirSync(root, { recursive: true });
				// Resolved once, per call. On macOS the temporary directory an operator points at
				// is usually `/var/...`, a symlink to `/private/var/...`, so every containment
				// test against the unresolved root would fail on a path that is genuinely inside.
				const realRoot = fs.realpathSync(root);

				const resolved = resolveInside(realRoot, named);
				if (!resolved.ok) return errorResult(resolved.message);

				const replaced = fs.existsSync(resolved.target);
				fs.mkdirSync(path.dirname(resolved.target), { recursive: true });
				fs.writeFileSync(resolved.target, text, "utf8");

				return {
					content: [
						{
							type: "text" as const,
							text: replaced
								? `Replaced \`${relative}\` (${bytes} bytes). A file was already there, and its previous contents are gone.`
								: `Wrote \`${relative}\` (${bytes} bytes).`,
						},
					],
					details: { path: relative, bytes, replaced },
				};
			} catch (error) {
				// Every filesystem call above can fail for a reason no check predicts: a full
				// disk, a permission, a file where a directory has to be. A thrown exception out
				// of a tool is not something the model can act on, so it comes back as a refusal
				// carrying the reason instead.
				return errorResult(
					`Could not write \`${relative}\`: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},
	};
}

/**
 * Split the path the model gave into the segments it actually names, or say why it is refused.
 *
 * Backslash counts as a separator alongside `/`. It is one on Windows, and treating it as a
 * plain character here would let `notes\..\..\escape.md` through the `..` check on Linux and
 * then act as an escape wherever the file is later read on Windows. The cost is that a file
 * name cannot contain a literal backslash, which no agent needs.
 */
function readSegments(given: string): string[] | string {
	if (given.includes("\0")) {
		// Node throws on a null byte rather than returning an error, and a thrown tool call
		// tells the model nothing. It is also the oldest way to make one layer see a path that
		// a lower layer then truncates at the byte.
		return "The path contains a null byte. Write the name as plain text, like `notes/findings.md`.";
	}
	if (path.isAbsolute(given)) {
		return (
			`\`${given}\` is an absolute path, and this tool writes only inside this conversation's ` +
			"directory. Give a path relative to it, like `notes/findings.md`."
		);
	}
	if (given.startsWith("~")) {
		// pi's own resolver expands `~`, so a model that learned the habit there would otherwise
		// get a directory literally called `~` inside the root and never know which happened.
		return (
			`\`${given}\` starts with \`~\`, which this tool does not expand to a home directory. ` +
			"Give a path relative to this conversation's directory, like `notes/findings.md`."
		);
	}

	const segments = given.split(/[\\/]+/);
	if (segments.includes("..")) {
		// Checked segment by segment, so it catches the forms that only escape once the path is
		// worked out. `notes/../../escape.md` has no leading `..` and looks like a child of
		// `notes/`; resolved, it is a sibling of the root.
		return (
			`\`${given}\` climbs out of this conversation's directory with \`..\`. Give a path that ` +
			"only goes downwards, like `notes/findings.md`."
		);
	}

	const named = segments.filter((segment) => segment !== "" && segment !== ".");
	if (named.length === 0) {
		// Covers the empty string, `.`, and a path that is only separators. Each of these
		// resolves to the directory itself, and a write to a directory is not a file.
		return (
			`\`${given}\` names no file: it points at the directory itself. Give a name inside it, ` +
			"like `notes/findings.md`."
		);
	}
	return named;
}

/**
 * Resolve the destination, and refuse anything that leaves the root once symlinks count.
 *
 * What is checked. The deepest part of the chain that already exists is handed to the
 * operating system, which says where it really is. A directory inside the root that is a
 * symlink pointing out of it is the failure this guards: every check in `readSegments` passes,
 * `notes/` reads as a child, and the bytes land wherever the link goes. The destination itself
 * is checked too, and a symlink there is refused outright rather than followed, because
 * writing through it writes to its target.
 *
 * What is not promised. This is a check, not a lock. Node offers no rooted write here, so
 * between the check and `writeFileSync` another process could swap a directory in the chain
 * for a symlink, and the write would follow it. It does hold against the realistic case, an
 * agent that creates a link and then writes through it, because that second write comes back
 * through this same function.
 */
function resolveInside(realRoot: string, named: string[]): Resolved {
	const relative = named.join("/");
	const target = path.join(realRoot, ...named);

	// The segment checks already forbid every way to reach this, so it should never fire. It
	// stays because it is the one line that states the property directly, and it is cheap.
	if (target !== realRoot && !target.startsWith(realRoot + path.sep)) {
		return refuse(
			`\`${relative}\` resolves outside this conversation's directory. Give a path that stays inside it.`,
		);
	}

	let ancestor = path.dirname(target);
	while (ancestor.length > realRoot.length) {
		if (!existsOrIsLink(ancestor)) {
			ancestor = path.dirname(ancestor);
			continue;
		}
		let real: string;
		try {
			real = fs.realpathSync(ancestor);
		} catch {
			// The path exists as a link but resolves to nothing. Creating anything under it
			// would depend on where a broken link is later repointed.
			return refuse(
				`\`${relative}\` sits under a broken symbolic link. Choose a path that does not go through it.`,
			);
		}
		if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
			return refuse(
				`\`${relative}\` goes through a symbolic link that leaves this conversation's ` +
					"directory, so writing it would put the file outside. Choose a path that stays inside.",
			);
		}
		break;
	}

	const existing = lstatOrNull(target);
	if (existing?.isSymbolicLink()) {
		return refuse(
			`\`${relative}\` is already a symbolic link. Writing through it would put the bytes ` +
				"wherever it points, which may be outside this conversation's directory. Use another name.",
		);
	}
	if (existing?.isDirectory()) {
		return refuse(
			`\`${relative}\` is already a directory, so it cannot be written as a file. Give a file name inside it.`,
		);
	}
	return { ok: true, target };
}

/**
 * A resolution or a refusal, told apart by a flag rather than by the type.
 *
 * Both halves carry a string, so returning the message on its own would make the two
 * indistinguishable at the call site: an escaping path would read as a destination.
 */
type Resolved = { ok: true; target: string } | { ok: false; message: string };

function refuse(message: string): Resolved {
	return { ok: false, message };
}

/** `lstat`, so a symlink counts as present even when what it points at is not. */
function existsOrIsLink(candidate: string): boolean {
	return lstatOrNull(candidate) !== null;
}

function lstatOrNull(candidate: string): fs.Stats | null {
	try {
		return fs.lstatSync(candidate);
	} catch {
		return null;
	}
}

function errorResult(message: string): SaveResult {
	return {
		content: [{ type: "text" as const, text: message }],
		details: { path: null, bytes: 0, replaced: false },
		isError: true,
	};
}
