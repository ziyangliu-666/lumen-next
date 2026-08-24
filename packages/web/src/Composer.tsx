/**
 * One input box and one question: where does this sentence go?
 *
 * Not two verbs. "Keep talking" and "hand over" are the same act — you say something — and
 * they differ only in how much of the conversation travels with it. Asking a person to
 * choose a verb makes them work out the consequence themselves; asking them to choose a
 * recipient is a question they can always answer.
 */

import { useState } from "react";
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
	// Only ever read while `busy` is true, when the select showing it is on screen — so its
	// idle value never matters, and "queue" is the safer of the two to land on first.
	const [choice, setChoice] = useState("queue");

	const node = state.selected ? state.nodes[state.selected] : undefined;
	const live = node ? isLive(node) : false;
	const busy = node?.busy === true;
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
	// Gated on `busy`, not only on `choice`: the select holding "queue"/"cutIn" only exists
	// on screen while busy, but `choice` itself does not reset the moment work finishes —
	// reading it unguarded left last turn's "wait" or "cut in" as this turn's target on an
	// idle point that never offered either.
	const target: Target =
		busy && (choice === "queue" || choice === "cutIn") ? { kind: choice } : { kind: "continue" };

	const blocked = !live || !state.connected;

	function send() {
		const trimmed = text.trim();
		if (!trimmed || blocked) return;
		onSend(trimmed, target);
		setText("");
		setChoice("queue");
	}

	return (
		<div className="composer">
			{node && !live && (
				<div className="row">
					<span className="warn">
						You are reading a window that has ended. It cannot be typed into.
					</span>
					{ahead && (
						<button type="button" onClick={() => onSelect(ahead)}>
							go to the live point ({state.nodes[ahead]?.agent})
						</button>
					)}
				</div>
			)}

			<div className="row">
				{/* A dropdown with one real choice in it is chrome, not a control — so idle
				    shows a plain label. While it is working there is an actual question
				    (wait, or cut in), so that is the one moment a select earns its place. */}
				{busy ? (
					<select value={choice} onChange={(event) => setChoice(event.target.value)}>
						<option value="queue">wait for this turn to end</option>
						<option value="cutIn">cut in now</option>
					</select>
				) : (
					<span className="target">talk to {node?.agent ?? "…"}</span>
				)}
				<span className="hint targetHint">{describeTarget(target)}</span>
				{busy && (
					<button type="button" className="stop" onClick={onAbort}>
						stop
					</button>
				)}
			</div>

			<textarea
				value={text}
				placeholder={
					!state.connected
						? "not connected"
						: !live
							? `this window is ${node?.state === "aborted" ? "stopped" : node?.state === "failed" ? "failed" : "closed"} — nothing can be sent to it`
							: busy
								? choice === "cutIn"
									? `${node?.agent} is working — this reaches it before its next thought`
									: `${node?.agent} is working — this waits until this turn ends`
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
