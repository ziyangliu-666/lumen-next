/**
 * `listConversationRecords`, the part of `persist.ts` that `conversations.list` leans on to
 * fold every saved-but-not-live conversation into the panel — see `Conversations.tsx`.
 *
 * `writeConversationRecord` and `readConversationRecord` are exercised only as the setup they
 * already were before this file existed; what is new here is reading a whole directory back,
 * across namespaces, and refusing to be tripped up by the temp file a write briefly leaves
 * beside its target.
 */

import { afterAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ConversationRecord } from "@lumen/kernel";

// `persist.ts` reads `LUMEN_STATE` once, at module load, into its own `STATE` constant — so
// this has to be set, and the module imported, before any of that constant's readers run.
// Vitest gives every test file a fresh module registry, so this does not leak into any other
// file's view of `persist.ts`.
const STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-state-"));
process.env.LUMEN_STATE = STATE_DIR;

const { listConversationRecords, writeConversationRecord } = await import("../src/persist.ts");

afterAll(() => {
	fs.rmSync(STATE_DIR, { recursive: true, force: true });
});

/** A minimally valid record — enough for `parseConversationRecord` to accept it. */
function record(key: string, spend = 0): ConversationRecord {
	return {
		version: 1,
		key,
		startedAt: Date.now(),
		savedAt: Date.now(),
		spend,
		model: "deepseek/deepseek-v4-flash",
		trace: { runId: "run-1", rootId: null, nodes: {}, children: {} },
		ideas: { ideas: {}, children: {} },
		said: {},
	};
}

describe("listConversationRecords", () => {
	it("returns nothing for a namespace with no directory yet", () => {
		expect(listConversationRecords("nobody-has-written-here")).toEqual([]);
	});

	it("reads back every record saved directly under a null namespace", () => {
		writeConversationRecord(null, "one", record("one-raw"));
		writeConversationRecord(null, "two", record("two-raw"));

		const keys = listConversationRecords(null)
			.map((r) => r.key)
			.sort();

		expect(keys).toEqual(["one-raw", "two-raw"]);
	});

	it("keeps one namespace's records out of another's listing", () => {
		writeConversationRecord("alice", "a1", record("alice-run"));

		expect(listConversationRecords("alice").map((r) => r.key)).toEqual(["alice-run"]);
		// The null-namespace pair from the previous test is still there, and alice's is not
		// mixed into it — namespaces are separate directories, not a filter over one.
		expect(listConversationRecords(null).map((r) => r.key).sort()).toEqual(["one-raw", "two-raw"]);
	});

	it("skips the temp file a write leaves beside its target mid-rename", () => {
		// `writeConversationRecord` itself always renames this away — this reproduces the
		// narrow window where it has not yet, by writing one by hand and leaving it in place.
		fs.writeFileSync(path.join(STATE_DIR, "partial.json.tmp-deadbeef"), "not valid json", "utf8");

		const keys = listConversationRecords(null)
			.map((r) => r.key)
			.sort();

		expect(keys).toEqual(["one-raw", "two-raw"]);
	});
});
