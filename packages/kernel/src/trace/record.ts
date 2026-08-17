/**
 * Attach one pi session to one trace node.
 *
 * Everything a person sees about a running agent comes through here: its tool calls in
 * order, its streaming text, its token spend, and the sentence it finally returned.
 *
 * The recorder never decides when a node ends. The caller does, because only the caller
 * knows whether the run stopped because it finished, because a tool threw, or because
 * the user pressed stop, and those three must not collapse into one word.
 */

import type { Trace } from "./trace.ts";
import type { Usage } from "./types.ts";

/** The subset of `AgentSession` this file needs. Narrow on purpose, so tests can fake it. */
export interface RecordableSession {
	subscribe(listener: (event: any) => void): () => void;
}

/** One line for the collapsed view of a step. */
export function stepTitle(tool: string, args: any): string {
	if (!args || typeof args !== "object") return tool;
	switch (tool) {
		case "bash":
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

function previewOf(result: any, limit = 400): string {
	const text = textOf(result?.content).trim();
	return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

/**
 * Subscribe to a session and write everything it does into `nodeId`.
 *
 * Returns the unsubscribe function. Call it before the node closes; a listener left on
 * a disposed session keeps the session object alive and, worse, keeps writing steps
 * into a node the interface has already drawn as finished.
 */
export function record(trace: Trace, nodeId: string, session: RecordableSession): () => void {
	let assistantText = "";

	return session.subscribe((event: any) => {
		switch (event.type) {
			case "message_start": {
				if (event.message?.role === "assistant") assistantText = "";
				return;
			}
			case "message_update": {
				const inner = event.assistantMessageEvent;
				if (inner?.type === "text_delta" && typeof inner.delta === "string") {
					assistantText += inner.delta;
					trace.emit({ type: "text", nodeId, delta: inner.delta });
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
				// summary flickering to empty every time the agent picks up a tool.
				if (text) trace.updateNode(nodeId, { summary: text });
				else if (assistantText.trim()) {
					trace.updateNode(nodeId, { summary: assistantText.trim() });
				}
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
				trace.closeStep(
					nodeId,
					event.toolCallId,
					event.isError ? "failed" : "done",
					previewOf(event.result),
				);
				// A tool that ran nested model work reports it here, and adding it keeps the
				// node's own line honest. But a spawning tool's children are trace nodes
				// that already carry their own spend, and `rollupUsage` walks them. Adding
				// the tool's usage as well would bill every subagent twice, on the screen
				// that shows the user what the run cost. So the step that opened children
				// is the one step whose usage is deliberately dropped.
				const spawned = trace
					.node(nodeId)
					.steps.find((step) => step.id === event.toolCallId)?.childIds?.length;
				if (!spawned) trace.addUsage(nodeId, event.result?.usage as Usage | undefined);
				return;
			}
			default:
				return;
		}
	});
}
