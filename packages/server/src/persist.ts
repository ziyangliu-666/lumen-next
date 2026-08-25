/**
 * Where a conversation's durable record lives on disk, and the atomic read/write around it.
 *
 * Deliberately not under `SESSIONS` (`packages/server/src/index.ts`'s own constant). That
 * directory is the root the `save` tool is rooted at — `createSaveTool({ root: cwd })` in
 * `runtime.ts`, with `cwd` set to one conversation's own subdirectory of it — and everything
 * `resolveInside` (`@lumen/kernel`'s `save.ts`) will let an agent's `save` call reach is
 * somewhere under that root. If lumen's own record of a conversation sat inside the directory
 * an agent can write into, an agent could overwrite it with an ordinary `save` call, by naming
 * the right path. So this lives in a sibling tree, `~/.lumen/state/` by default, that no path
 * an agent's tools ever resolve against reaches at all: not a permission that happens to be
 * withheld, but a directory outside the one root every write in this process is checked
 * against.
 *
 * The layout mirrors `SESSIONS`'s own on purpose — `<namespace>/<key>.json` when
 * `LUMEN_BASIC_AUTH` names more than one user, `<key>.json` otherwise — so the same
 * containment property `Conversation`'s constructor already documents (`namespace: null`
 * means "do not nest," keeping the single-operator layout flat) holds here too: user A's
 * record and user B's sit under different directories, and a reader only ever asks for its
 * own authenticated namespace's.
 *
 * A conversation's pi sessions live here too, one directory per key beside its `.json`
 * record — `<key>.sessions/` (namespaced the same way) — for exactly the reason the record
 * itself does: `SessionManager.create` needs a real directory to write into, and the one
 * directory an agent's own tools can reach (`SESSIONS`, `Conversation.workspace`) is the one
 * directory a session file must never sit in. See `RuntimeOptions.sessionsDir` for the other
 * half of that boundary, on the kernel side.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseConversationRecord, type ConversationRecord } from "@lumen/kernel";

const STATE = process.env.LUMEN_STATE ?? join(homedir(), ".lumen", "state");

function recordPath(namespace: string | null, safeKey: string): string {
	return namespace ? join(STATE, namespace, `${safeKey}.json`) : join(STATE, `${safeKey}.json`);
}

/**
 * Where this conversation's own pi sessions are written.
 *
 * `.sessions` rather than a bare `<key>/`, so the directory sits beside `<key>.json` without
 * ever colliding with it or with another key that happens to prefix this one. `readdirSync`
 * in `listConversationRecords` below already only looks at `.json` names, so a listing never
 * mistakes this for a second, malformed record.
 */
export function conversationSessionsDir(namespace: string | null, safeKey: string): string {
	return namespace ? join(STATE, namespace, `${safeKey}.sessions`) : join(STATE, `${safeKey}.sessions`);
}

/**
 * Write `record` for good. A temp file beside the target, then a rename over it: `rename` is
 * atomic on the same filesystem, so a process that dies mid-write leaves either the old file,
 * untouched, or the new one, whole — never a half-written file a later read chokes on.
 *
 * Errors are the caller's to handle. A background save that fails must not be allowed to take
 * the conversation down with it — see `Conversation.persist` in `index.ts`, which catches and
 * logs rather than letting this throw into an event listener.
 */
export function writeConversationRecord(namespace: string | null, safeKey: string, record: ConversationRecord): void {
	const target = recordPath(namespace, safeKey);
	mkdirSync(dirname(target), { recursive: true });
	const tmp = `${target}.tmp-${randomBytes(6).toString("hex")}`;
	writeFileSync(tmp, JSON.stringify(record), "utf8");
	renameSync(tmp, target);
}

/**
 * Read a saved record back, or `null` if there is none, it cannot be parsed, or
 * `parseConversationRecord` does not recognise its schema version — see that function for why
 * refusing is preferred to guessing. A caller that gets `null` should treat the key exactly as
 * it would a key nothing was ever saved under: fresh, not broken.
 */
export function readConversationRecord(namespace: string | null, safeKey: string): ConversationRecord | null {
	const target = recordPath(namespace, safeKey);
	if (!existsSync(target)) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(target, "utf8"));
	} catch (error) {
		console.error(`could not read saved conversation ${target}:`, error);
		return null;
	}
	const record = parseConversationRecord(parsed);
	if (!record) {
		console.error(`saved conversation ${target} has an unrecognised shape or schema version; ignoring it.`);
	}
	return record;
}

/**
 * Every saved record for one operator (or, in multi-user mode, one authenticated user),
 * for `conversations.list` to fold in beside whatever this process still holds live.
 *
 * A plain directory listing rather than an index kept up to date: this is asked for rarely
 * — once per person who opens the panel — and the directory holds nothing but one small JSON
 * file per conversation, so reading all of them back is cheap enough to do on request. A
 * record that fails to parse is skipped, the same way `readConversationRecord` already treats
 * one caller asked for directly: reported to the console, not thrown, so one damaged file
 * cannot blank the whole list.
 *
 * Returns `[]` for a namespace with no directory yet — the ordinary case for an operator who
 * has never had a conversation outlive its process.
 */
export function listConversationRecords(namespace: string | null): ConversationRecord[] {
	const dir = namespace ? join(STATE, namespace) : STATE;
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	const records: ConversationRecord[] = [];
	for (const entry of entries) {
		// Excludes the `.tmp-<hex>` files `writeConversationRecord` briefly leaves beside a
		// target mid-write: they carry a `.json.tmp-...` name, which this suffix check does not
		// match, so a read racing a write never picks up a partial file by accident.
		if (!entry.endsWith(".json")) continue;
		const record = readConversationRecord(namespace, entry.slice(0, -".json".length));
		if (record) records.push(record);
	}
	return records;
}
