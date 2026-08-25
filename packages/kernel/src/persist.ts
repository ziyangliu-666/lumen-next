/**
 * The durable shape of a conversation, and the pure logic for reading one back honestly.
 *
 * A conversation's engine — `Runtime`, and the pi sessions underneath it — lives only in
 * this process's memory, and stays that way; see `runtime.ts`'s own comment on
 * `SessionManager.inMemory()` for why a subagent's actual context window is never coming
 * back once the process ends. What this file exists for is different: the *record* of what
 * happened — the call tree, the findings, what the person typed — is already built as plain
 * data (`Trace.snapshot()`, `IdeaGraph.snapshot()`, the `said` map) every time a reconnecting
 * browser is sent one, so it costs nothing new to keep a copy of that data on disk too. The
 * server (`packages/server/src/persist.ts`) does the actual reading and writing; everything
 * here is pure, which is what makes it something `packages/kernel/test` can check without a
 * filesystem.
 *
 * Nothing here persists `TraceEvent`s. Those include a `text`/`thinking` delta per streamed
 * token — hundreds in one turn — and are a wire format, not a record; only the snapshots they
 * accumulate into are saved.
 */

import type { IdeaSnapshot } from "./ideas.ts";
import type { TraceNode, TraceSnapshot } from "./trace/types.ts";

/**
 * The record format's own version.
 *
 * Bumped whenever a field below changes shape in a way an older reader would misread rather
 * than merely ignore. `parseConversationRecord` accepts every version it still has a shape
 * for — see the union below — and refuses only a version it has never known, on purpose: a
 * record written by a later build, half-loaded by an older one guessing at today's shape, is
 * the failure that turns "we have history" into "we have a crash on startup." A record from
 * an *earlier* known version is not that failure; it is read back exactly as it always was.
 */
export const SCHEMA_VERSION = 2;

/**
 * Everything about a conversation worth keeping once its process is gone.
 *
 * `key` is the raw key a browser's `?s=` names it by — not namespaced, the same convention
 * `ConversationSummary.key` in the server's protocol already uses. `spend` and `model` are
 * carried alongside `trace` rather than recomputed from it purely so a list of saved
 * conversations can be built without re-walking every node of every one of them; `trace`
 * remains the actual source of truth for both.
 */
export interface ConversationRecordV1 {
	version: 1;
	key: string;
	/** When the conversation's root window opened. */
	startedAt: number;
	/** When this record was written — the last moment anything here is known to be true. */
	savedAt: number;
	spend: number;
	/** `provider/id`, the model the conversation was using as of `savedAt`. */
	model: string;
	trace: TraceSnapshot;
	ideas: IdeaSnapshot;
	said: Record<string, string[]>;
}

/**
 * One pi session, as of `savedAt`.
 *
 * A line can span several nodes: compaction rotates a line onto a new node while pi keeps
 * driving the very same session (see `Runtime.rotate`), so this is not one entry per node.
 * It is one entry per session file, carrying the node it currently points at. Without
 * `agent` a restored session could not be rebuilt with the right system prompt and tool
 * allowlist; without `nodeId` nothing would know which point on the graph it belongs to.
 */
export interface LineRecord {
	/** The line's own id, e.g. `l-3`. Matches `Line.id` for the process that wrote this. */
	id: string;
	/** The agent this line is running. Names the entry in the registry, not a display label. */
	agent: string;
	/** Delegation depth. Carried by every node on the line; compaction does not change it. */
	depth: number;
	/** The window this line is currently sitting in. */
	nodeId: string;
	/** Where pi wrote this session's own JSONL. */
	sessionFile: string;
}

/** As `ConversationRecordV1`, plus a durable pointer to each live line's own pi session. */
export interface ConversationRecordV2 {
	version: 2;
	key: string;
	startedAt: number;
	savedAt: number;
	spend: number;
	model: string;
	trace: TraceSnapshot;
	ideas: IdeaSnapshot;
	said: Record<string, string[]>;
	/**
	 * One entry per line that was still live when this was saved. A run built with no
	 * `sessionsDir` (the kernel's own tests, or any caller that does not want durability)
	 * produces `[]` here, and restores exactly as a `ConversationRecordV1` always did:
	 * read-only history, with no session file anywhere to resume.
	 */
	lines: LineRecord[];
}

/** Widen this, and `parseConversationRecord`, whenever `SCHEMA_VERSION` moves again. */
export type ConversationRecord = ConversationRecordV1 | ConversationRecordV2;

/**
 * Validate an unknown value read off disk as a `ConversationRecord`, or refuse it.
 *
 * Refusing rather than coercing is the whole point: a `null` here has to be a caller's cue to
 * treat the key as though nothing were ever saved for it, not a half-built object with fields
 * silently missing. `version` is checked against the versions this function knows how to
 * read — 1 and 2 today — not against `SCHEMA_VERSION` alone, which is only ever the *newest*
 * of those; an old record is a known shape, not an unknown one. Every other field is checked
 * for the right JavaScript type but not walked deeper — `trace` and `ideas` are checked for
 * merely existing and being an object, since a real, structural mismatch inside either one is
 * exactly what bumping `SCHEMA_VERSION` on a future change is for.
 */
export function parseConversationRecord(raw: unknown): ConversationRecord | null {
	if (!raw || typeof raw !== "object") return null;
	const candidate = raw as Partial<ConversationRecordV1> & Partial<ConversationRecordV2>;
	if (candidate.version !== 1 && candidate.version !== 2) return null;
	if (
		typeof candidate.key !== "string" ||
		typeof candidate.startedAt !== "number" ||
		typeof candidate.savedAt !== "number" ||
		typeof candidate.spend !== "number" ||
		typeof candidate.model !== "string" ||
		!candidate.trace ||
		typeof candidate.trace !== "object" ||
		!candidate.ideas ||
		typeof candidate.ideas !== "object" ||
		!candidate.said ||
		typeof candidate.said !== "object"
	) {
		return null;
	}
	if (candidate.version === 2 && !Array.isArray(candidate.lines)) return null;
	return candidate as ConversationRecord;
}

/**
 * Rewrite every node still `running` in a saved snapshot to an honest, closed state.
 *
 * A saved trace is read back long after the process advancing it may be gone — see this
 * module's header. `running` is a claim about a live context window backed by a real pi
 * session, and once the process that held it has ended there is no such window: nothing will
 * ever advance it, finish it, or answer a message sent to it. Left as `running`, a reconnecting
 * browser draws a spinner over a point that is not working and never will again.
 *
 * `aborted`, not `failed`. `NodeState`'s own doc comment keeps the two apart because a user
 * pressing stop and a tool throwing are billed and retried differently — and neither happened
 * here. Of the two, `aborted` is the honest one anyway: `failed` means something went wrong
 * *inside* the window, and nothing did; this window was stopped from outside, by the process
 * running it ending, which is the same shape `aborted` already names for a person pressing
 * stop. It is not a person this time, but it is the same kind of stop, not the same kind of
 * error.
 *
 * `until` is when the node is honestly known to have stopped: not "now", which is whenever
 * somebody happens to reconnect and could be days after the process actually died, but
 * `savedAt` off the same record — the last moment this trace is known to have been true. Steps
 * still `running` on a node this touches are closed the same way, mirroring what `Trace`'s own
 * `closeNode` already does for a node closed mid-step.
 */
export function endInterruptedNodes(snapshot: TraceSnapshot, until: number): TraceSnapshot {
	let changed = false;
	const nodes: Record<string, TraceNode> = {};
	for (const [id, node] of Object.entries(snapshot.nodes)) {
		if (node.state !== "running") {
			nodes[id] = node;
			continue;
		}
		changed = true;
		const endedAt = node.endedAt ?? until;
		const worked = node.busy && node.busySince ? node.worked + Math.max(0, until - node.busySince) : node.worked;
		nodes[id] = {
			...node,
			state: "aborted",
			endedAt,
			worked,
			busy: false,
			busySince: null,
			steps: node.steps.map((step) =>
				step.state === "running" ? { ...step, state: "aborted", endedAt } : step,
			),
		};
	}
	return changed ? { ...snapshot, nodes } : snapshot;
}

/**
 * `endInterruptedNodes`'s honest ending, for one node whose line has just been found
 * reachable or not — shared so the three outcomes below tell the identical accounting
 * story: what a busy stretch banked, and what a step caught mid-flight closes to.
 */
function settle(node: TraceNode, until: number): { endedAt: number; worked: number } {
	const endedAt = node.endedAt ?? until;
	const worked = node.busy && node.busySince ? node.worked + Math.max(0, until - node.busySince) : node.worked;
	return { endedAt, worked };
}

/**
 * `endInterruptedNodes`'s counterpart for a conversation that came back, not just a
 * conversation being read. Every `running` node in a saved trace is exactly one live line's
 * current window (see `Runtime.lines`), and by the time this runs the resume attempt has
 * already tried, for real, to reopen every one of them — so unlike `endInterruptedNodes`,
 * which has no such information and must treat every `running` node alike, this can tell
 * the three outcomes that attempt actually produced apart:
 *
 *   reachable     the line's pi session reopened. The window is exactly what it always
 *                 was — still `running`, still there to type into — except nothing is
 *                 mid-turn any more: the process that was streaming it is the one that
 *                 died, not this one, so `busy` clears and a step caught running closes to
 *                 `aborted`, the same honest accounting `endInterruptedNodes` uses for a
 *                 node it closes outright. The point itself does not close.
 *   unreachable   the line named a real reason it could not reopen — an unknown agent, a
 *                 session file that is gone. Closed to `failed` and carrying that reason on
 *                 `error`, so the point says why rather than just going quiet. `failed`, not
 *                 `aborted`: `endInterruptedNodes`'s own doc comment draws that line on
 *                 whether something went wrong or the window was merely stopped from
 *                 outside, and a session file that cannot be found is the former.
 *   unaccounted   a `running` node `outcomes` says nothing about at all — no `LineRecord`
 *                 ever named it. Not expected in an honestly-written record (`Runtime.lines`
 *                 covers every live line whenever `sessionsDir` is set, which a resumable
 *                 record always was), but a reader must not assume its writer was honest;
 *                 this is `endInterruptedNodes`'s own ending, for the same reason.
 *
 * `outcomes` maps a node id to `null` for reachable, or the failure's own message for
 * unreachable. A node this trace never asked about at all is the third case above.
 */
export function reconcileResumedTrace(
	snapshot: TraceSnapshot,
	until: number,
	outcomes: ReadonlyMap<string, string | null>,
): TraceSnapshot {
	let changed = false;
	const nodes: Record<string, TraceNode> = {};
	for (const [id, node] of Object.entries(snapshot.nodes)) {
		if (node.state !== "running") {
			nodes[id] = node;
			continue;
		}
		const outcome = outcomes.has(id) ? outcomes.get(id)! : undefined;
		if (outcome === undefined) {
			// Unaccounted for: nobody claims this window came back. Honestly closed, exactly
			// as `endInterruptedNodes` closes every `running` node in the read-only path.
			changed = true;
			const { endedAt, worked } = settle(node, until);
			nodes[id] = {
				...node,
				state: "aborted",
				endedAt,
				worked,
				busy: false,
				busySince: null,
				steps: node.steps.map((step) =>
					step.state === "running" ? { ...step, state: "aborted", endedAt } : step,
				),
			};
			continue;
		}
		if (outcome !== null) {
			// Unreachable, with a reason. Closed to `failed` so the point says why.
			changed = true;
			const { endedAt, worked } = settle(node, until);
			nodes[id] = {
				...node,
				state: "failed",
				endedAt,
				worked,
				busy: false,
				busySince: null,
				error: outcome,
				steps: node.steps.map((step) =>
					step.state === "running" ? { ...step, state: "aborted", endedAt } : step,
				),
			};
			continue;
		}
		// Reachable: the window stays open. Only a stretch caught mid-turn is not honest any
		// more, so only that is cleaned up — the node's own `state` never changes here.
		if (node.busy || node.steps.some((step) => step.state === "running")) {
			changed = true;
			const { worked } = settle(node, until);
			nodes[id] = {
				...node,
				worked,
				busy: false,
				busySince: null,
				steps: node.steps.map((step) =>
					step.state === "running" ? { ...step, state: "aborted", endedAt: until } : step,
				),
			};
		} else {
			nodes[id] = node;
		}
	}
	return changed ? { ...snapshot, nodes } : snapshot;
}
