/**
 * Attach one pi session to the trace.
 *
 * Everything a person sees about a running agent comes through here: its tool calls in
 * order, its streaming text, its token spend, and the sentence it finally returned.
 *
 * The recorder never decides when a node ends, and it never decides where the next one
 * goes. The caller does, because only the caller knows whether the run stopped because it
 * finished, because a tool threw, or because the user pressed stop, and those three must
 * not collapse into one word. Compaction is reported the same way: this file says the
 * window was replaced and hands over the summary, and the caller decides what that means
 * for the tree.
 *
 * Which node events land on is read fresh every time, not captured once. A session
 * outlives any single node of its own — compaction ends one window and starts another
 * inside the same session — so a recorder holding one id would keep writing into a node
 * the interface has already drawn as finished.
 */

import type { Trace } from "./trace.ts";
import type { Usage } from "./types.ts";

/** The subset of `AgentSession` this file needs. Narrow on purpose, so tests can fake it. */
export interface RecordableSession {
	subscribe(listener: (event: any) => void): () => void;
}

/** What the recorder reports when a context window is replaced by its own summary. */
export interface CompactionReport {
	reason: "manual" | "threshold" | "overflow";
	/** The text the next window starts from. */
	summary: string;
	/** What the summarising call itself cost. Real money, and easy to forget to bill. */
	usage?: Usage;
}

export interface RecordOptions {
	/** The node to write to right now. Called per event, never cached. */
	nodeId: () => string;
	/**
	 * The window filled up (or someone asked) and was replaced by its summary. Fired only
	 * when compaction actually produced something: an aborted or failed attempt leaves the
	 * conversation exactly where it was, and reporting it would open a node for a window
	 * that never existed.
	 */
	onCompaction?: (report: CompactionReport) => void;
}

/** One line for the collapsed view of a step. */
export function stepTitle(tool: string, args: any): string {
	if (!args || typeof args !== "object") return tool;
	switch (tool) {
		case "bash":
		// Drawn the same as `bash`, because to a person reading the row it is the same
		// thing: a command that ran. Where it ran is the panel's business, not this line's.
		case "run":
			return `$ ${String(args.command ?? "").split("\n")[0]}`;
		case "read": {
			const range = args.offset ? `:${args.offset}-${(args.offset ?? 0) + (args.limit ?? 0)}` : "";
			return `read ${args.path ?? args.file_path ?? ""}${range}`;
		}
		case "write":
			return `write ${args.path ?? args.file_path ?? ""}`;
		case "edit":
			return `edit ${args.path ?? args.file_path ?? ""}`;
		case "grep":
			return `grep /${args.pattern ?? ""}/ in ${args.path ?? "."}`;
		case "find":
		case "ls":
			return `${tool} ${args.path ?? args.pattern ?? "."}`;
		case "retrieve":
			return `retrieve ${JSON.stringify(args.query ?? "")}`;
		case "subagent":
			return subagentTitle(args);
		case "save":
			return `save ${args.path ?? ""}`;
		case "finish":
			// The reason, not the word "finish". This row is the last thing on the point and
			// the only place the agent says why it stopped rather than what it found.
			return `finish: ${String(args.reason ?? "").split("\n")[0]}`;
		default:
			return tool;
	}
}

function subagentTitle(args: any): string {
	if (Array.isArray(args.tasks)) {
		const names = args.tasks.map((task: any) => task.agent).join(", ");
		return `${args.tasks.length} subagents in parallel: ${names}`;
	}
	if (Array.isArray(args.chain)) {
		return `chain: ${args.chain.map((step: any) => step.agent).join(" -> ")}`;
	}
	if (Array.isArray(args.branches)) {
		const names = args.branches.map((task: any) => task.agent).join(", ");
		return `started ${args.branches.length} line(s): ${names}`;
	}
	return `subagent ${args.agent ?? ""}`;
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block: any) => block?.type === "text")
		.map((block: any) => block.text as string)
		.join("");
}

/** How much of a tool result the collapsed view shows before the rest waits behind a click. */
const PREVIEW_LIMIT = 400;

/**
 * How much of a tool result this trace keeps in full, addressable later through
 * `Trace.fullResult`.
 *
 * A number, not "as much as arrives". A `bash` command piping a build log or a `web_search`
 * with a page of results can run to megabytes, and holding every one of those in full for the
 * life of the conversation would grow the process's memory for output almost nobody asks to
 * see past the preview. One megabyte is enough for the runs a person actually opens — a long
 * file, a few hundred lines of test output — without one pathological command exhausting the
 * process. Past this cap the stored copy is itself cut short, and
 * `Trace.fullResult`'s `truncated` flag says so: the response tells the truth about being
 * incomplete rather than quietly handing back a torso and calling it the whole result.
 */
const FULL_RESULT_CAP = 1_000_000;

/** Whether `text` fits within `limit`, and the slice of it that does. */
function clip(text: string, limit: number): { text: string; truncated: boolean } {
	return text.length > limit ? { text: text.slice(0, limit), truncated: true } : { text, truncated: false };
}

/**
 * Subscribe to a session and write everything it does into whichever node is current.
 *
 * Returns the unsubscribe function. Call it before the line closes; a listener left on a
 * disposed session keeps the session object alive and, worse, keeps writing steps into a
 * node the interface has already drawn as finished.
 */
export function record(
	trace: Trace,
	session: RecordableSession,
	options: RecordOptions,
): () => void {
	let assistantText = "";
	// The current turn's reasoning, accumulated the same way `assistantText` is. Streamed
	// live via the `thinking` event exactly as before; archived into the node's permanent
	// `steps` on `message_end` (below) so it survives the turn that produced it instead of
	// being overwritten by the next one.
	let thinkingText = "";

	return session.subscribe((event: any) => {
		const nodeId = options.nodeId();
		switch (event.type) {
			case "message_start": {
				if (event.message?.role === "assistant") {
					assistantText = "";
					thinkingText = "";
					trace.emit({ type: "turn_start", nodeId });
				}
				return;
			}
			case "message_update": {
				const inner = event.assistantMessageEvent;
				if (inner?.type === "text_delta" && typeof inner.delta === "string") {
					assistantText += inner.delta;
					trace.emit({ type: "text", nodeId, delta: inner.delta });
				} else if (inner?.type === "thinking_delta" && typeof inner.delta === "string") {
					// Reasoning streams ahead of the answer and is not part of it. Forwarded on
					// its own event rather than folded into `text`, so the two can be drawn apart:
					// the thinking is the work, the text is what the parent actually receives.
					thinkingText += inner.delta;
					trace.emit({ type: "thinking", nodeId, delta: inner.delta });
				}
				return;
			}
			case "message_end": {
				const message = event.message;
				if (message?.role !== "assistant") return;
				trace.addUsage(nodeId, message.usage as Usage | undefined);
				if (message.model) trace.updateNode(nodeId, { model: message.model });
				const text = textOf(message.content).trim();
				// The last assistant text is what the parent receives, so it is the summary.
				// Keeping the previous one when this turn was tool calls only stops the
				// summary flickering to empty every time the agent picks up a tool. It is
				// computed once and reused below for the archived step, so `summary` and the
				// step it is drawn from can never read two different strings for the same turn.
				const replyText = text || assistantText.trim();
				if (replyText) trace.updateNode(nodeId, { summary: replyText });
				// The turn is over: archive what it reasoned and what it said before this
				// node's steps move on to whatever tool calls it decided on. This has to
				// happen here, and not in `message_update`, because a step is a finished
				// thing and streaming deltas are not done arriving until `message_end` says
				// so. It also has to happen before this function returns to the event loop:
				// `tool_execution_start` for this same turn's tool calls is the very next
				// event on this subscription (pi finalises the assistant message before it
				// executes anything the message asked for), so pushing these steps now,
				// synchronously, is what puts them ahead of those tool steps in `node.steps`
				// rather than after them.
				//
				// Reasoning archives before the reply, matching the order the model actually
				// produced them in within one turn: it thinks, then it writes, and only then
				// does whatever it decided on get carried out. That gives the interleaving
				// this fix exists for across turns too: a turn that is tool calls only
				// archives no reply here at all, so the reply from before it stays the last
				// one on screen until a later turn, having seen the tool's result, adds its
				// own: reasoning, tool calls, reply, in the order they happened, every turn,
				// not only the last one.
				if (thinkingText.trim()) {
					const step = trace.openStep(nodeId, {
						id: `think-${crypto.randomUUID()}`,
						tool: "thinking",
						args: undefined,
						title: "thinking",
						kind: "thinking",
					});
					trace.closeStep(nodeId, step.id, "done", thinkingText.trim());
				}
				if (replyText) {
					const step = trace.openStep(nodeId, {
						id: `reply-${crypto.randomUUID()}`,
						tool: "reply",
						args: undefined,
						title: "reply",
						kind: "reply",
					});
					trace.closeStep(nodeId, step.id, "done", replyText);
				}
				// Last, after both archives: the interface may now drop its live copy of what
				// this turn said, because the steps above are holding it. Emitting this before
				// the archiving would leave a gap where the text is in neither place.
				trace.emit({ type: "turn_end", nodeId });
				return;
			}
			case "tool_execution_start": {
				trace.openStep(nodeId, {
					id: event.toolCallId,
					tool: event.toolName,
					args: event.args,
					title: stepTitle(event.toolName, event.args),
				});
				return;
			}
			case "tool_execution_end": {
				// A spawning call's verdict comes from its children, not from pi's flag. On
				// an abort the tool still returns normally, so `isError` is false and the
				// step drew a green tick over children the person had just stopped. The
				// children are on the graph saying `stopped`; the row above them must not
				// contradict that.
				const children = trace
					.node(nodeId)
					.steps.find((step) => step.id === event.toolCallId)?.childIds;
				// Ask what actually went wrong, not what is missing. Testing for `!== "done"`
				// marked every successful delegation as failed, because a child that answers
				// stays `running` — it is still a live window someone can go back to, and
				// nothing closes it. The states that mean trouble are the two that say so.
				const ended = (children ?? []).map((childId) => trace.node(childId).state);
				const allBad =
					ended.length > 0 && ended.every((state) => state === "failed" || state === "aborted");
				// And say which trouble. The children below this row are labelled `stopped`
				// or `failed`; collapsing both into one word here would contradict them.
				const stepState = event.isError
					? "failed"
					: allBad
						? ended.every((state) => state === "aborted")
							? "aborted"
							: "failed"
						: "done";
				const text = textOf(event.result?.content).trim();
				const preview = clip(text, PREVIEW_LIMIT);
				// The step keeps the short version for the collapsed view; the trace keeps the
				// rest, if there is any, for the on-demand fetch this preview's `truncated` flag
				// invites the browser to make. See `FULL_RESULT_CAP` for why a very long result
				// is cut a second time, further out, rather than kept whole.
				trace.closeStep(
					nodeId,
					event.toolCallId,
					stepState,
					preview.truncated ? `${preview.text}...` : preview.text,
					preview.truncated,
				);
				const full = clip(text, FULL_RESULT_CAP);
				trace.setFullResult(event.toolCallId, full.text, full.truncated);
				// A tool that ran nested model work reports it here, and adding it keeps the
				// node's own line honest. But a spawning tool's children are trace nodes
				// that already carry their own spend, and `rollupUsage` walks them. Adding
				// the tool's usage as well would bill every subagent twice, on the screen
				// that shows the user what the run cost. So the step that opened children
				// is the one step whose usage is deliberately dropped.
				if (!children?.length) trace.addUsage(nodeId, event.result?.usage as Usage | undefined);
				return;
			}
			case "compaction_end": {
				// `result` is absent when the attempt was aborted or errored. Nothing was
				// replaced in that case, so there is no new window and nothing to report.
				const result = event.result;
				if (event.aborted || !result?.summary) return;
				// Bill the summarising call to the window that ran out. It is a real model
				// call, and the node it belongs to is the one whose length caused it.
				trace.addUsage(nodeId, result.usage as Usage | undefined);
				options.onCompaction?.({
					reason: event.reason,
					summary: result.summary,
					usage: result.usage,
				});
				return;
			}
			default:
				return;
		}
	});
}
