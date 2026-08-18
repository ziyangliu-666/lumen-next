/**
 * What crosses the socket.
 *
 * Only one direction needs defining. Server to client is `TraceEvent` verbatim plus one
 * `hello`, because the trace events are already the description of what happened and
 * translating them into a second vocabulary would mean two things to keep in step.
 */

import type { AgentSpec, TraceEvent, TraceSnapshot } from "@lumen/kernel";

/**
 * Where the user's sentence goes, and therefore how much of the conversation goes with it.
 *
 * This is the one question the interface asks. Everything else — token cost, whether a new
 * window opens, whether the agent may change — follows from the answer, and none of it is
 * something a person should have to work out.
 */
export type Target =
	/**
	 * Same window. It remembers everything.
	 *
	 * `whenBusy` only means anything when a turn is already running, which is normal once
	 * the lead drives itself. It is not two more kinds of target, because both still mean
	 * "this window, which remembers everything" — the only difference is the moment the
	 * sentence reaches the model.
	 *
	 *   queue   after the turn has finished its own work. It reads what came back first.
	 *   cutIn   at the model's next step. Subagents already running are left alone; this
	 *           redirects the thinking, it does not cancel the work.
	 */
	| { kind: "continue"; whenBusy?: "queue" | "cutIn" }
	/** Compact first, then say it to the window that replaces this one. Same agent. */
	| { kind: "next" }
	/** Compact first, then hand the summary to a different agent. */
	| { kind: "handoff"; agent: string }
	/**
	 * Start a line of its own from here. It sees only your sentence, and nothing comes
	 * back — you stay where you are and open it when you want to.
	 */
	| { kind: "send"; agent: string };

export type ClientFrame =
	| { type: "say"; nodeId: string; text: string; target: Target }
	| { type: "abort"; nodeId: string };

export type ServerFrame =
	| {
			type: "hello";
			agents: AgentSpec[];
			snapshot: TraceSnapshot;
			rootNodeId: string | null;
			/**
			 * What the person typed, by the point that received it. The trace only records
			 * what agents did, so without this a reconnecting page redraws a conversation
			 * with one side of it missing.
			 */
			said: Record<string, string[]>;
	  }
	/** Something went wrong handling a frame. Shown to the person, not thrown away. */
	| { type: "error"; message: string }
	/**
	 * What you asked for happened differently, and here is how.
	 *
	 * Kept apart from `error` because they teach opposite things. Calling a handled
	 * fallback an error trains a person to ignore the word, and then the real one goes
	 * unread too.
	 */
	| { type: "notice"; message: string }
	| TraceEvent;
