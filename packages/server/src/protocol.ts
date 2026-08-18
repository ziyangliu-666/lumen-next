/**
 * What crosses the socket.
 *
 * Only one direction needs defining. Server to client is `TraceEvent` verbatim plus one
 * `hello`, because the trace events are already the description of what happened and
 * translating them into a second vocabulary would mean two things to keep in step.
 */

import type { AgentSpec, AutopilotStop, TraceEvent, TraceSnapshot } from "@lumen/kernel";

/**
 * Where the user's sentence goes, and therefore how much of the conversation goes with it.
 *
 * This is the one question the interface asks. Everything else — token cost, whether a new
 * window opens, whether the agent may change — follows from the answer, and none of it is
 * something a person should have to work out.
 */
export type Target =
	/** Same window. It remembers everything. */
	| { kind: "continue" }
	/**
	 * Same window, into the turn it is already running. Offered only while it is working.
	 *
	 *   queue   it finishes what it is doing, then reads you.
	 *   cutIn   it reads you before its next thought, and keeps the workers it started.
	 *
	 * Two more answers to the question the composer already asks, rather than a setting.
	 * A remembered preference is a rule a person sets once and is surprised by later, and
	 * the right answer differs sentence by sentence: a correction wants to cut in, an extra
	 * question wants to wait its turn.
	 *
	 * Neither is an abort. The work already running was paid for, and cutting in redirects
	 * the thinking without throwing away the workers.
	 */
	| { kind: "queue" }
	| { kind: "cutIn" }
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
	| { type: "abort"; nodeId: string }
	/**
	 * The switch that makes the lead carry on by itself.
	 *
	 * It carries the value wanted rather than toggling. Two tabs are two views of one run,
	 * and a toggle would leave them alternating instead of agreeing.
	 */
	| { type: "auto"; on: boolean };

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
			/** Where the switch stands, so a reconnecting tab does not draw it off. */
			auto: AutoState;
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
	/**
	 * The state of the switch, whenever it changes.
	 *
	 * A frame of its own rather than part of the trace, and the reason is the one rule: a
	 * point is one context window, and this loop outlives the window it started in — it goes
	 * on driving the window that replaces it. A fact about the run does not belong inside the
	 * structure whose unit is a window. It cannot ride on `notice` either: a switch cannot be
	 * drawn from prose, and a tab that reconnects would have no way to learn where it stands.
	 */
	| { type: "auto"; state: AutoState }
	| TraceEvent;

export interface AutoState {
	on: boolean;
	/**
	 * Turns taken without anyone asking, since the switch went on.
	 *
	 * Information, not a limit. The only cap is money, because turns differ in cost by two
	 * orders of magnitude between a one-line answer and a fan-out of twelve workers, so a
	 * turn limit would either cut cheap useful work short or wave an expensive run through.
	 */
	turns: number;
	/** What this run may spend. The spend beside it on screen is the page's own sum. */
	budget: number;
	/** How the last automatic run ended. Cleared when the switch goes on again. */
	stopped?: AutopilotStop;
}
