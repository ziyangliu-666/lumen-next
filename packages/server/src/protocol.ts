/**
 * What crosses the socket.
 *
 * Only one direction needs defining. Server to client is `TraceEvent` verbatim plus one
 * `hello`, because the trace events are already the description of what happened and
 * translating them into a second vocabulary would mean two things to keep in step.
 */

import type {
	AgentSpec,
	AutopilotStop,
	IdeaEvent,
	IdeaSnapshot,
	TraceEvent,
	TraceSnapshot,
} from "@lumen/kernel";

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
	/**
	 * Whether this is a saved record, read back after the process that ran it is gone, rather
	 * than a conversation actually running now.
	 *
	 * The one fact in this object that is not really "fixed for the life of the conversation"
	 * so much as "fixed for the life of the page" — it cannot become false partway through a
	 * connection, because there is no live `Runtime` behind a restored conversation for
	 * anything to attach to. Named here, in `Fixed`, rather than as a one-off `notice`: a
	 * notice scrolls off after a few messages (see `state.ts`'s `messages.slice(-3)`), and
	 * this has to stay true on screen for as long as the page does.
	 */
	restored: boolean;
}

/**
 * One conversation as it looks from outside itself: enough to show in a list and enough to
 * open it again, nothing more. Sent only on request — see `conversations.list` below —
 * because building it walks every node of every conversation the caller can see, and that
 * cost has no reason to be paid by a socket that never asks.
 *
 * `kind` is the one field that says which of two different things this row is. Every other
 * field keeps the same meaning for both: a `"live"` row reads it off the running `Runtime`,
 * a `"history"` row reads it off the saved record, but `spend` is still "everything spent",
 * `nodeCount` is still "how many windows exist", and so on. Opening either kind goes through
 * the same restore path — a live conversation is just found already in memory instead of
 * read off disk.
 */
export interface ConversationSummary {
	/** The `?s=` value that reaches this conversation again. Never namespaced: a client only
	 * ever holds its own raw key, the same one `lumen.session` already stores. */
	key: string;
	/**
	 * Whether this conversation is still running, or only a saved record of one that ended.
	 *
	 * `"live"` means its process still holds it: it can be talked to, it can be stopped, and
	 * its spend is still climbing. `"history"` means the process that ran it is gone; what is
	 * left is exactly what `persist.ts` wrote before it ended, and opening it is read-only —
	 * see `Fixed.restored` for what that looks like once inside.
	 */
	kind: "live" | "history";
	/**
	 * Everything spent so far. For `"live"` this is the running total and will keep climbing;
	 * for `"history"` it is the total as of the last save, and will not — see `kind`.
	 */
	spend: number;
	/** Whether it is currently running itself, unattended or not. Always false for `"history"`:
	 * there is no process left to be running one. */
	auto: boolean;
	/** How many windows are doing something right now, as opposed to sitting idle. Always 0
	 * for `"history"`, for the same reason `auto` is always false. */
	busyCount: number;
	/** How many windows exist at all — a rough size, so an empty one and a sprawling one
	 * do not look the same in a list. */
	nodeCount: number;
	/** When its root window opened, so a list can be read oldest or newest first. */
	startedAt: number;
	/** Whether a socket is attached to it right now — a conversation nobody is orphaning. */
	attached: boolean;
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
	 * List one directory inside this conversation's own directory (`Fixed.workspace`).
	 *
	 * `path` is relative to that directory, never absolute — `""` asks for the directory
	 * itself. Read-only: there is no frame that uploads, edits, or deletes anything here, and
	 * the server enforces that by calling functions that only know how to read.
	 */
	| { type: "files.list"; path: string }
	/**
	 * Read one file's whole content from the same directory.
	 *
	 * Refused if it is too large or, for a file with no recognized preview extension, not
	 * UTF-8 text — see `files.ts`'s `readFile` for the two size caps and which extensions
	 * read as an image or a PDF instead of text.
	 */
	| { type: "files.read"; path: string }
	/**
	 * Ask for one step's whole result, past what its `preview` shows.
	 *
	 * Offered only for a step whose `truncated` is true — see `Step.truncated` in
	 * `@lumen/kernel`'s trace types for why that flag, and not a scan of the preview text, is
	 * what the browser trusts. `nodeId` names which node's step list `stepId` came from, the
	 * way a step is always reached in the trace tree; the lookup itself is by `stepId` alone
	 * (step ids are unique across the whole run), so the client can key its cache the same way.
	 */
	| { type: "step.full"; nodeId: string; stepId: string }
	/**
	 * List every other conversation this operator can see (or, once `LUMEN_BASIC_AUTH` names
	 * more than one person, that this authenticated user alone can see): every one this server
	 * still holds live, plus every saved record on disk that is not one of those.
	 *
	 * On request rather than pushed, the same choice as `files.list`: it is a per-tab "let me
	 * see" rather than a fact every attached socket needs pushed to it the moment another
	 * conversation opens, closes, or finishes saving elsewhere.
	 */
	| { type: "conversations.list" }
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
			/** The findings graph, the same way `snapshot` is the call tree. */
			ideas: IdeaSnapshot;
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
			/**
			 * How many *other* conversations this server still holds for this operator, right
			 * now. Just the count, not the list: cheap enough to send unconditionally, so a tab
			 * that opens onto an empty conversation can say at once that it is not the only one
			 * running, before anybody has to think to ask.
			 */
			otherConversations: number;
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
	/**
	 * One directory's immediate children, answering a `files.list` frame. Sent only to the
	 * tab that asked — the tree is a per-tab UI concern, not shared run state every attached
	 * tab needs to hear about, unlike the trace and idea events below.
	 */
	| {
			type: "files.tree";
			path: string;
			entries: { name: string; kind: "file" | "dir" }[];
	  }
	/**
	 * One file's whole content, answering a `files.read` frame. Sent only to the tab that
	 * asked.
	 *
	 * `text` is the common case — an agent's own notes, a report, a log. `binary` is an image
	 * or a PDF, base64-encoded with its MIME type: see `files.ts`'s `FileContent` for exactly
	 * which extensions take this path and the size cap that governs each kind.
	 */
	| {
			type: "files.content";
			path: string;
			content: { kind: "text"; text: string } | { kind: "binary"; mime: string; base64: string };
	  }
	/**
	 * One step's whole result, answering a `step.full` frame. Sent only to the tab that asked
	 * — the same reason `files.content` is, and not a shared trace event: a person expanding
	 * one long tool result is not a fact about the run every attached tab needs pushed to it.
	 *
	 * `truncated` is the trace's own cap talking, not the preview's: it is true only when the
	 * result was so long that even the stored copy had to be cut short — see `FULL_RESULT_CAP`
	 * in `@lumen/kernel`'s `record.ts`. A step whose preview was truncated but whose full
	 * result fit under that cap answers with `truncated: false` here, honestly, because what
	 * came back this time really is everything.
	 */
	| { type: "step.content"; stepId: string; text: string; truncated: boolean }
	/** Answers `conversations.list`. Sent only to the tab that asked. */
	| { type: "conversations.list"; conversations: ConversationSummary[] }
	| TraceEvent
	| IdeaEvent;

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
