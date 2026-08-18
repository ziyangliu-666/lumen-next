/**
 * A line: one pi session, and the chain of context windows it has burned through.
 *
 * This is the piece that was missing. A session and a node used to be the same thing, so
 * a node could only ever live as long as one prompt, and four unrelated problems all
 * turned out to be the same problem: subagents could not be talked to again, the
 * delegation tool's parent node was frozen at construction, compaction had nowhere to put
 * the window that replaced the old one, and nothing owned a session long enough for a
 * person to come back to it.
 *
 * A line separates the two:
 *
 *   session   one conversation, one message history, one agent, one system prompt.
 *   node      one context window inside that conversation.
 *
 * They are not one-to-one because compaction ends a window without ending the
 * conversation. So a line is a session plus a moving pointer at the window that is
 * currently live. `currentNodeId` moves exactly once per compaction and never otherwise.
 */

import type { AgentSpec } from "./agents/types.ts";

/**
 * The bit of `AgentSession` a line needs. Narrow so tests can drive a line without a model.
 *
 * `steer` and `followUp` are the two ways a sentence can join a turn that is already
 * running, and pi delivers them at different moments: `steer` reaches the model at its next
 * step, `followUp` waits until the turn has no work of its own left. Both are here rather
 * than an options argument on `prompt`, because `prompt` refuses outright while the session
 * is streaming — the choice is not a variation on sending a prompt, it is the other thing
 * you can do instead.
 */
export interface LineSession {
	prompt(text: string): Promise<void>;
	/** Join the running turn at the model's next step. Subagents in flight keep running. */
	steer(text: string): Promise<void>;
	/** Join the running turn once it has run out of work of its own. */
	followUp(text: string): Promise<void>;
	/** Whether a turn is running right now. pi's own answer, not our record of it. */
	readonly isStreaming: boolean;
	/** Resolves when no turn, retry or compaction is in flight. */
	waitForIdle(): Promise<void>;
	abort(): Promise<void>;
	dispose(): void;
	subscribe(listener: (event: any) => void): () => void;
	compact(customInstructions?: string): Promise<{ summary: string }>;
}

export interface Line {
	id: string;
	spec: AgentSpec;
	session: LineSession;
	/**
	 * The window events are written to right now. Everything that reads this must read it
	 * late — at event time, at tool-call time — never at construction. That is the whole
	 * point of the field.
	 */
	currentNodeId: string;
	/**
	 * Delegation depth, carried by every window on this line. Compaction does not change
	 * it: a compacted window is the same conversation continuing, not a derived one, and
	 * charging it a level would let a long line quietly lose the ability to delegate.
	 */
	depth: number;
	/** Unsubscribe the recorder. Call before disposing the session. */
	stop: () => void;
	/**
	 * Set while a handoff is borrowing the compactor to write its farewell note.
	 *
	 * A handoff needs the same thing compaction produces — a self-contained summary — so it
	 * runs the same machinery. But its successor is a different agent on a different line,
	 * not this line's next window. Without this flag the compaction event would also open a
	 * same-agent successor here, leaving a window on the graph that was born, handed a
	 * summary, and never spoken to.
	 */
	handingOff?: boolean;
}
