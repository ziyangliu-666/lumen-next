/**
 * Every other conversation this operator can reach, live or saved, and the way back into
 * one of them.
 *
 * The problem this exists for is not "add a feature," it is a specific failure: a tab that
 * opens with no memory of a running conversation — a private window, a different browser, a
 * second machine, `lumen.session` cleared by hand — has no way to tell that the memory it is
 * missing is sitting on the server, still running, still spending. It looks exactly like a
 * conversation that was never started, and a person who trusts that look loses whatever was
 * running under the tab they left. This panel is the fix: not a reaper that would kill a run
 * somebody left going on purpose, but a place that says plainly what the server still holds,
 * so a run is only ever abandoned on purpose, never by a tab that could not see it.
 *
 * Two different things sit in one list, told apart by `kind`. A `"live"` row is a conversation
 * a process is still driving: it can still be talked to, and its spend is still climbing. A
 * `"history"` row is a saved record read back from disk — see the README's "Where a
 * conversation lives" — of one whose process has already ended: opening it is read-only, the
 * same restore path a reconnecting tab already takes, and its spend is exactly what it spent,
 * not a number still growing. Restarting the server empties the live half of this list; the
 * saved half is what is left once it does.
 *
 * Two ways to reach this same list, told apart by `page`. As a modal (`page: false`, the
 * default) it opens over a conversation already on screen, dismissed by clicking away or
 * pressing escape — the original failure this component was built for: a tab that opens with
 * no memory of a running conversation, because it is a fresh browser, a different machine, or
 * simply a URL nobody had visited before. As a page (`page: true`) it *is* `/`, `main.tsx`'s
 * own landing route — the answer to that same failure turned into the front door instead of a
 * rescue hatch: there is no conversation behind it to click away to, so there is no backdrop
 * and no close button, only the list and, in `Landing`, a way to start one.
 */

import { useEffect } from "react";
import type { ConversationSummary } from "@lumen/server/protocol";
import { money } from "@lumen/kernel/trace/types";

/** "3m ago", "1h ago" — coarse on purpose, this is for telling conversations apart, not a clock. */
function ago(ms: number): string {
	const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
	if (seconds < 60) return "just now";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.round(hours / 24)}d ago`;
}

export function Conversations({
	conversations,
	onRequest,
	onRejoin,
	onClose,
	page = false,
}: {
	/** Null while the list has not been asked for yet; see `state.ts`'s field of the same name. */
	conversations: ConversationSummary[] | null;
	/** Sends the `conversations.list` request. Called once, on open. */
	onRequest: () => void;
	onRejoin: (key: string) => void;
	/** Ignored when `page` is true — a page has no backdrop to dismiss and no caller waiting
	 * to hear that it closed. */
	onClose: () => void;
	/**
	 * Renders inline as the page itself, with no backdrop, no escape-to-close, and no close
	 * button — rather than as a dismissible sheet over whatever conversation is behind it.
	 * See this file's own doc comment for the two places this is used from.
	 */
	page?: boolean;
}) {
	// Deliberately once, on mount, and not on `onRequest` itself — that identity changes every
	// render since it closes over `send`. A conversation elsewhere spending money while this
	// panel sits open goes stale, but polling it would mean a frame kind that pushes updates
	// nobody asked for to a socket that already has plenty to listen to; closing and
	// reopening this panel asks again.
	useEffect(() => {
		onRequest();
	}, []);

	useEffect(() => {
		// A page has nothing to dismiss itself out of — there is no conversation behind it to
		// return to, and `onClose` is a no-op its caller passed only to satisfy the type.
		if (page) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, page]);

	const body = (
		<>
			<div className="row">
				<strong>{page ? "your conversations" : "other conversations"}</strong>
				<span className="hint">running ones first, then everything saved on disk</span>
				{!page && (
					<button type="button" onClick={onClose}>
						close
					</button>
				)}
			</div>

			{conversations === null && <p className="help">asking the server…</p>}

			{conversations !== null && conversations.length === 0 && (
				<p className="help">
					{page
						? "Nothing yet. Say something below to start your first conversation."
						: "None. Nothing else is running, and nothing else has been saved."}
				</p>
			)}

			{conversations !== null && conversations.length > 0 && (
				<div className="conversations">
					{conversations.map((conversation) => (
						<div className="conversationRow" key={conversation.key}>
							<div className="conversationMain">
								{/* The same glyph and the same class the call graph and the reading pane
								    use for a node's own marker — see `Canvas.tsx` and `Detail.tsx` — so
								    "still working" reads as one consistent signal across the whole page,
								    not a second vocabulary invented for this one panel. A history row is
								    never busy, so it always draws the idle dot; `historyTag` below is what
								    actually tells the two kinds apart. */}
								<span className={`mark ${conversation.busyCount > 0 ? "running" : ""}`}>
									{conversation.busyCount > 0 ? "◍" : "•"}
								</span>
								<span className="conversationKey">{conversation.key}</span>
								{/* Same word Composer.tsx and main.tsx already use for a restored
								    conversation — one term, not a synonym invented for this one badge. */}
								{conversation.kind === "history" && <span className="historyTag">history</span>}
								{conversation.auto && <span className="warn">running by itself</span>}
								{conversation.attached && <span className="hint">open in another tab</span>}
							</div>
							<div className="conversationMeta hint">
								{money(conversation.spend)}{" "}
								{conversation.kind === "live" ? "spent so far" : "spent total"} ·{" "}
								{conversation.nodeCount} {conversation.nodeCount === 1 ? "window" : "windows"} ·
								started {ago(conversation.startedAt)}
							</div>
							<button type="button" onClick={() => onRejoin(conversation.key)}>
								{conversation.kind === "live" ? "rejoin" : "open"}
							</button>
						</div>
					))}
				</div>
			)}

			<p className="help">
				Opening a live conversation switches this tab into it and does not stop or close
				anything — a run left going by itself keeps going, and keeps spending, until it
				finishes, is stopped, or reaches its own budget. Opening a history one switches
				this tab into a saved record instead: nothing can be sent to it, but everything
				it did, including the files it produced, can still be read.
			</p>
		</>
	);

	if (page) {
		return <div className="settings">{body}</div>;
	}

	return (
		<div className="sheet" onClick={onClose}>
			<div className="settings" onClick={(event) => event.stopPropagation()}>
				{body}
			</div>
		</div>
	);
}
