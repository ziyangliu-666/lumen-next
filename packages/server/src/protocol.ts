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

/**
 * What the page may change about a run, in one object.
 *
 * One shape rather than a frame per setting, because the list will grow and every new
 * setting would otherwise cost a frame kind, a case in the reducer and a case on the
 * server. A patch is a partial of this; anything absent is left alone.
 *
 * Only what can honestly be changed while a run exists is here. `cwd` and the extension
 * list are not, and their absence is a decision rather than an omission: extensions execute
 * arbitrary code with the operator's permissions, so a page that could add one would be a
 * page that can install a tool into an agent. That decision stays on the command line.
 */
export interface Settings {
	/** Dollars one automatic run may spend. Applies at once, including to a run in progress. */
	autoBudget: number;
	/** `provider/id`, from `Fixed.models`. Applies to windows opened from now on. */
	model: string;
	/**
	 * How many tokens of recent conversation pi keeps when it compacts, or null for pi's own
	 * default. Applies to windows opened from now on. Set it low to watch a line compact
	 * without holding a long conversation first.
	 */
	keepRecentTokens: number | null;
	/**
	 * How deep delegation may go. Applies to work started from now on.
	 *
	 * Raising it multiplies the tree rather than lengthening it: every level fans out again.
	 * Nothing here bounds that except the budget, which is the honest place for it to be
	 * bounded.
	 */
	maxDepth: number;
	/** How many children one delegation call runs at once. The rest queue behind them. */
	maxConcurrent: number;
	/**
	 * A folder the agents were asked about, or null for a conversation that is about nothing
	 * on this disk. Applies to windows opened from now on.
	 *
	 * Null by default, and that default is the point. The agents used to start in whatever
	 * directory the server was launched from, so a question about mathematics arrived with a
	 * code search tool pointed at somebody's repository, and a worker answered it by grepping
	 * source that had nothing to do with the question.
	 */
	material: string | null;
}

/**
 * What the page shows and cannot change. Fixed when the process started.
 *
 * Shown rather than hidden. A settings page that lists only the changeable things teaches
 * that the rest does not exist, and the two that matter most for reading a run — which
 * directory the agents can see, and which extensions are loaded — are exactly the two
 * nobody should be able to change from a browser.
 */
export interface Fixed {
	/**
	 * This conversation's own directory: its working directory, and where its files land.
	 *
	 * Fixed for the life of the conversation rather than for the life of the process, and
	 * shown because it is the only way to find what a run produced. Nothing else here can be
	 * changed at all; this one cannot be changed, but it is different per conversation.
	 */
	workspace: string;
	extensions: string[];
	/**
	 * The machine an agent's commands run on, in words, or null when there is none.
	 *
	 * Shown because it is a bill. Every second that machine is up is charged to this
	 * conversation's total, and a person reading that total should be able to see what it
	 * is a total of. Not changeable from here for the same reason the extension list is
	 * not: it is a decision about what code may execute, and a browser is not where that
	 * decision is made.
	 */
	compute: string | null;
	port: number;
	/** Every model the operator has credentials for. */
	models: { id: string; name: string }[];
}

export type ClientFrame =
	| { type: "say"; nodeId: string; text: string; target: Target }
	| { type: "abort"; nodeId: string }
	/**
	 * The switch that makes the lead carry on by itself.
	 *
	 * It carries the value wanted rather than toggling. Two tabs are two views of one run,
	 * and a toggle would leave them alternating instead of agreeing.
	 */
	| { type: "auto"; on: boolean }
	/** Change some settings. Anything left out of the patch is left as it is. */
	| { type: "settings"; patch: Partial<Settings> }
	/**
	 * Done with this conversation: stop driving it, close its windows, forget it.
	 *
	 * The one thing that may end a run other than the process. Nothing reclaims a
	 * conversation on its own — a timer would eventually collect the line somebody left
	 * running on purpose — but a person saying they have finished with it is not a timer, and
	 * without this every fresh start left a runtime behind holding live sessions, and an
	 * automatic run still spending in a window nobody could see any more.
	 */
	| { type: "close" };

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
			settings: Settings;
			fixed: Fixed;
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
	/** The settings as they now stand, after any change, to every attached tab. */
	| { type: "settings"; settings: Settings }
	| TraceEvent;

/**
 * What the switch is doing. Deliberately not what it is allowed to spend: that is
 * `Settings.autoBudget`, and it was carried here too until the two disagreed on screen —
 * the budget was changed in the panel and the header went on quoting the old number. One
 * fact, one place, however cheap the copy looks.
 */
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
	/** How the last automatic run ended. Cleared when the switch goes on again. */
	stopped?: AutopilotStop;
}
