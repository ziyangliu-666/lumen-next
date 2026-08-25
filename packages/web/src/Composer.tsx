/**
 * One input box, one send button, always.
 *
 * Not two verbs. "Keep talking" and "hand over" are the same act — you say something — and
 * they differ only in how much of the conversation travels with it. Asking a person to
 * choose a verb makes them work out the consequence themselves; asking them to choose a
 * recipient is a question they can always answer.
 *
 * While a point is busy there used to be a second question here too: wait for the turn to
 * end, or cut in now. That choice is gone, but not in the direction an earlier version of
 * this file chose: a sentence typed at a busy point does not wait, it steers — pi's own
 * `line.session.steer()` (see `Runtime.interject` in the kernel), which reaches the model at
 * its next step without touching the subagents it already sent out. Waiting was picked once
 * as the "safer" single behaviour and was wrong: a person typing to a point that is working
 * is not being cautious, they are trying to talk to it, and making that wait by default is
 * the thing worth calling ugly, not the choice this file used to offer.
 */

import { useEffect, useState } from "react";
import type { Target } from "@lumen/server/protocol";
import { describeTarget, frontierOf, isLive, quotable, type State } from "./state.ts";

export function Composer({
	state,
	onSend,
	onAbort,
	onSelect,
}: {
	state: State;
	onSend: (text: string, target: Target) => void;
	onAbort: () => void;
	onSelect: (nodeId: string) => void;
}) {
	const [text, setText] = useState("");
	/**
	 * Whether the stop button has been clicked and is waiting on the server to confirm it.
	 *
	 * A reviewer clicked stop and saw nothing happen for a moment — the click sends a frame
	 * and only the round trip actually stops the node, and until `busy` flips there was no
	 * visible difference between "the click landed" and "the click did nothing". This is set
	 * the instant the button is pressed, so the button itself is the acknowledgement.
	 */
	const [stopping, setStopping] = useState(false);

	const node = state.selected ? state.nodes[state.selected] : undefined;
	const live = node ? isLive(node) : false;
	const busy = node?.busy === true;

	// Cleared the moment there is nothing left to stop: `busy` actually went false (the
	// abort completed, or the node finished on its own), or a different point was selected
	// entirely. Without the second case, clicking stop on one point and then switching to
	// another busy point showed that point's own stop button as "stopping…" before anyone
	// had clicked it.
	useEffect(() => {
		setStopping(false);
	}, [node?.id, busy]);
	const cites = quotable(state);
	// Where this line actually is now, if you are standing on a window it has left behind.
	const ahead = node && !live ? frontierOf(state, node.id) : null;
	// Teach a reference that exists. Ids are a base-36 counter, so the one in the old
	// placeholder was a number the session might never reach.
	const exampleId = cites[cites.length - 1]?.id ?? node?.id ?? "";
	// A mistyped reference is passed through verbatim, so the receiving agent reads
	// "@n-zz" as part of the question rather than as a citation that failed.
	const unknown = [...text.matchAll(/@(n-[a-z0-9]+)/g)]
		.map((match) => match[1])
		.filter((id) => !state.nodes[id]);

	// `next`, `handoff` and `send` are still real — a line can still change hands, still
	// compact early, still branch off — but only an agent triggers them now, through its
	// own `subagent` call. Nobody reached for the manual versions of these from this box,
	// so the box no longer offers them; `Target` itself is unchanged; a person reading a
	// point that already changed hands still sees whose it is on the point itself.
	// A sentence typed while the point is busy always steers — it reaches the model at its
	// next step, the same way pi's own agent already lets you talk to something mid-turn.
	// The subagents already running are not touched by this; only what the point itself
	// does next can change.
	const target: Target = busy ? { kind: "cutIn" } : { kind: "continue" };

	const blocked = !live || !state.connected;

	function send() {
		const trimmed = text.trim();
		if (!trimmed || blocked) return;
		onSend(trimmed, target);
		setText("");
	}

	return (
		<div className="composer">
			{node && !live && (
				<div className="row">
					<span className="warn">
						{state.fixed?.restored
							? "This conversation is history: the process that ran it has ended, so none of its windows can be typed into."
							: "You are reading a window that has ended. It cannot be typed into."}
					</span>
					{ahead && (
						<button type="button" onClick={() => onSelect(ahead)}>
							go to the live point ({state.nodes[ahead]?.agent})
						</button>
					)}
				</div>
			)}

			<div className="row">
				{/* One send button, always. There used to be a real question here while a
				    point was busy — wait, or cut in — and a select earned its place for it.
				    That choice is gone: it always cuts in now, so idle and busy both get a
				    plain label; only the words differ. */}
				{busy ? (
					<span className="hint">
						{node?.agent ?? "it"} ({node?.id ?? "…"}) is working
					</span>
				) : (
					<span className="target">
						talk to {node?.agent ?? "…"} {node && <span className="meta id">{node.id}</span>}
					</span>
				)}
				<span className="hint targetHint">{describeTarget(target)}</span>
				{busy && (
					<button
						type="button"
						className="stop"
						disabled={stopping}
						onClick={() => {
							setStopping(true);
							onAbort();
						}}
					>
						{stopping ? "stopping…" : "stop"}
					</button>
				)}
			</div>

			<textarea
				value={text}
				placeholder={
					!state.connected
						? "not connected"
						: state.fixed?.restored
							? "this conversation ended when its process stopped — nothing can be sent to it"
							: !live
								? `this window is ${node?.state === "aborted" ? "stopped" : node?.state === "failed" ? "failed" : "closed"} — nothing can be sent to it`
								: busy
									? `${node?.agent} is working — this reaches it before its next thought`
									: exampleId
										? `say something. @${exampleId} pastes in what that point currently says`
										: "say something"
				}
				disabled={blocked}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						send();
					}
				}}
			/>

			{cites.length > 0 && (
				<div className="row cites">
					<span className="hint">quote:</span>
					{cites.slice(-6).map((cite) => (
						<button
							type="button"
							key={cite.id}
							className="cite"
							title={cite.summary?.slice(0, 200)}
							onClick={() => setText((current) => `${current}${current ? " " : ""}@${cite.id} `)}
						>
							@{cite.id} {cite.agent}
						</button>
					))}
				</div>
			)}

			{unknown.length > 0 && (
				<div className="row">
					<span className="warn">
						no such point: {unknown.join(", ")} — it will be sent as plain text
					</span>
				</div>
			)}

			<div className="row">
				<button type="button" onClick={send} disabled={blocked || !text.trim()}>
					send
				</button>
				<span className="hint">⌘↵</span>
			</div>
		</div>
	);
}
