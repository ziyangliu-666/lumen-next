/**
 * Read-only access to a conversation's own directory, for the browser tab that wants to look
 * at what an agent left there.
 *
 * The containment check is not written here a second time. `resolveInside` in
 * `@lumen/kernel`'s `save.ts` already answers "does this relative path stay inside the root,
 * once symlinks count", and it answers it the hard way — walking the chain of ancestors with
 * `realpathSync` rather than trusting the text of the path. A second, independent check here
 * would be a second place that boundary could quietly stop matching the first, and the whole
 * value of a security boundary is that there is exactly one of it. So `listDir` and `readFile`
 * both call the same `resolveInside` the `save` tool calls, and only add the small policy a
 * read needs on top: a listing wants a directory at the destination, a read wants a regular
 * file, and `resolveInside` itself takes no position on either — see its own doc comment for
 * why that split exists.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveInside, splitPath, DEFAULT_MAX_BYTES } from "@lumen/kernel";

export interface Entry {
	name: string;
	kind: "file" | "dir";
}

/**
 * One file's content, sent back to the browser tab that asked for it.
 *
 * Two kinds, not one. Text is the common case: an agent's own notes, a report, a log — and
 * it is sent as a plain string, the same as before this file could preview anything else.
 * `binary` covers the extensions in `PREVIEW_MIME` below: an image or a PDF, base64-encoded
 * so it fits inside the same JSON frame everything else on this socket already travels in.
 * Nothing else is read as `binary` — an unrecognized extension still goes through the UTF-8
 * check and is refused the way it always was, mojibake and executable content alike.
 */
export type FileContent = { kind: "text"; text: string } | { kind: "binary"; mime: string; base64: string };

/**
 * Extensions this viewer shows as a picture or a document, and the MIME type that goes with
 * each. `<img>` decodes the first group natively; `<embed type="application/pdf">` decodes
 * the second. Nothing outside this list is ever read as bytes-and-a-MIME-type — everything
 * else stays on the plain-text path, refused if it does not decode as UTF-8.
 */
const PREVIEW_MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".avif": "image/avif",
	".bmp": "image/bmp",
	".ico": "image/x-icon",
	".pdf": "application/pdf",
};

/**
 * 8 MiB, the size cap for an image or a PDF this viewer will send.
 *
 * A separate number from `DEFAULT_MAX_BYTES`, and deliberately larger. That cap is `save`'s
 * own limit — the most text a model emits in one call — and a picture or a document was never
 * written that way, so there is no reason to hold it to a limit meant for something else. This
 * one is still a limit, not "as large as the disk allows": a multi-hundred-megabyte file sent
 * as base64 over one JSON frame would swell by a third and sit in memory twice, once as bytes
 * and once as the encoded string, for a preview pane that gains nothing past a certain size a
 * browser could not usefully show anyway.
 */
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

/**
 * Where the path led, resolved and checked for containment, or the reason it was refused.
 * Shared by `listDir` and `readFile` so the boundary is asked exactly once per call.
 */
function locate(root: string, relPath: string): { target: string } | { error: string } {
	const segments = splitPath(relPath);
	if (typeof segments === "string") return { error: segments };

	let realRoot: string;
	try {
		realRoot = fs.realpathSync(root);
	} catch (error) {
		// The conversation's own directory is created before any socket can ask about it, so
		// this should not happen — but a directory that vanished under the process is a fact
		// worth reporting rather than a crash worth throwing.
		return { error: `This conversation's directory is gone: ${describeError(error)}` };
	}

	const resolved = resolveInside(realRoot, segments);
	if (!resolved.ok) return { error: resolved.message };
	return { target: resolved.target };
}

/**
 * List one directory's immediate children. `relPath` of `""` lists the root itself.
 *
 * Each entry's kind comes from `readdir`'s own dirent, not from a second stat call — cheap,
 * and a symlinked entry reads as neither a file nor a directory, which is what it is until
 * something asks to open it. Opening it is a separate `listDir` or `readFile` call on that
 * entry's own path, and that call is the one `resolveInside`'s ancestor walk protects: a
 * symlinked directory that leaves the root is refused there, not here.
 */
export function listDir(root: string, relPath: string): Entry[] | { error: string } {
	const located = locate(root, relPath);
	if ("error" in located) return located;

	const stat = lstatOrNull(located.target);
	if (!stat) return { error: `\`${relPath}\` does not exist.` };
	if (stat.isSymbolicLink()) {
		// Read through it, not into it: a symlink at the exact destination is exactly the case
		// `resolveInside`'s own ancestor walk does not cover, because the walk only follows the
		// links strictly above the target. `save.ts`'s write path refuses the same shape for
		// the same reason.
		return {
			error: `\`${relPath}\` is a symbolic link, which is not opened directly. Open what it points at by its own path, if that path is inside this directory.`,
		};
	}
	if (!stat.isDirectory()) {
		return { error: `\`${relPath}\` is a file, not a directory.` };
	}

	try {
		return fs
			.readdirSync(located.target, { withFileTypes: true })
			.map((entry) => ({
				name: entry.name,
				kind: (entry.isDirectory() ? "dir" : "file") as Entry["kind"],
			}))
			.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));
	} catch (error) {
		return { error: `Could not list \`${relPath}\`: ${describeError(error)}` };
	}
}

/**
 * Read one file's whole content, or say why not.
 *
 * A recognized image or PDF extension — see `PREVIEW_MIME` — is read as bytes and sent back
 * base64-encoded, checked against `MAX_PREVIEW_BYTES`. Everything else is read as text, checked
 * against `DEFAULT_MAX_BYTES` — the same cap `save` writes against, so nothing on this path
 * could not also have been written by an agent in one call — and refused if its bytes do not
 * decode as UTF-8, rather than sent through as garbage a browser would render as mojibake or,
 * worse, treat as something to run.
 *
 * The extension picks the path before either limit is checked. A `.png` too large for the text
 * cap but under the preview cap must not be refused by the wrong number, and a `.txt` file must
 * never be read as bytes-and-a-guess no matter what its content looks like — the decision is
 * the name, not a sniff of what is inside.
 */
export function readFile(root: string, relPath: string): { content: FileContent } | { error: string } {
	const located = locate(root, relPath);
	if ("error" in located) return located;

	const stat = lstatOrNull(located.target);
	if (!stat) return { error: `\`${relPath}\` does not exist.` };
	if (stat.isSymbolicLink()) {
		return {
			error: `\`${relPath}\` is a symbolic link, which is not opened directly. Open what it points at by its own path, if that path is inside this directory.`,
		};
	}
	if (stat.isDirectory()) {
		return { error: `\`${relPath}\` is a directory. Ask for one of the files inside it.` };
	}
	if (!stat.isFile()) {
		return { error: `\`${relPath}\` is not a regular file.` };
	}

	const mime = PREVIEW_MIME[path.extname(relPath).toLowerCase()];
	if (mime) {
		if (stat.size > MAX_PREVIEW_BYTES) {
			return {
				error: `\`${relPath}\` is ${stat.size} bytes, over the ${MAX_PREVIEW_BYTES}-byte preview limit this viewer reads. Open it another way.`,
			};
		}
		try {
			const bytes = fs.readFileSync(located.target);
			return { content: { kind: "binary", mime, base64: bytes.toString("base64") } };
		} catch (error) {
			return { error: `Could not read \`${relPath}\`: ${describeError(error)}` };
		}
	}

	if (stat.size > DEFAULT_MAX_BYTES) {
		return {
			error: `\`${relPath}\` is ${stat.size} bytes, over the ${DEFAULT_MAX_BYTES}-byte limit this viewer reads. Open it another way.`,
		};
	}

	let bytes: Buffer;
	try {
		bytes = fs.readFileSync(located.target);
	} catch (error) {
		return { error: `Could not read \`${relPath}\`: ${describeError(error)}` };
	}

	try {
		// `fatal: true` throws on a byte sequence that is not valid UTF-8, which is all the
		// binary detection a plain-text viewer needs — no MIME sniffing, no extension guessing.
		const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return { content: { kind: "text", text } };
	} catch {
		return { error: `\`${relPath}\` is not valid UTF-8 text, so it cannot be shown here.` };
	}
}

function lstatOrNull(candidate: string): fs.Stats | null {
	try {
		return fs.lstatSync(candidate);
	} catch {
		return null;
	}
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
