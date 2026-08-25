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
 * than merely ignore. `parseConversationRecord` refuses anything that does not match the
 * version this build knows, on purpose: a record written by a later build, half-loaded by an
 * older one guessing at today's shape, is the failure that turns "we have history" into "we
 * have a crash on startup."
 */
export const SCHEMA_VERSION = 1;

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

/** A union of one today. Widen this, and `parseConversationRecord`, when `SCHEMA_VERSION` moves. */
export type ConversationRecord = ConversationRecordV1;

/**
 * Validate an unknown value read off disk as a `ConversationRecord`, or refuse it.
 *
 * Refusing rather than coercing is the whole point: a `null` here has to be a caller's cue to
 * treat the key as though nothing were ever saved for it, not a half-built object with fields
 * silently missing. Only `version` is checked against a fixed number; every other field is
 * checked for the right JavaScript type but not walked deeper — `trace` and `ideas` are
 * checked for merely existing and being an object, since a real, structural mismatch inside
 * either one is exactly what bumping `SCHEMA_VERSION` on a future change is for.
 */
export function parseConversationRecord(raw: unknown): ConversationRecord | null {
	if (!raw || typeof raw !== "object") return null;
	const candidate = raw as Partial<ConversationRecord>;
	if (candidate.version !== SCHEMA_VERSION) return null;
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
