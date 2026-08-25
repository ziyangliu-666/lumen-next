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

import { useEffect, useRef, useState } from "react";
import type { Target } from "@lumen/server/protocol";
import { describeTarget, frontierOf, isLive, quotable, type State } from "./state.ts";
import { applySuggestion, suggestionsFor, triggerAt, type Suggestion } from "./complete.ts";

export function Composer({
	state,
	onSend,
	onAbort,
	onSelect,
	onCommand,
}: {
	state: State;
	onSend: (text: string, target: Target) => void;
	onAbort: () => void;
	onSelect: (nodeId: string) => void;
	/** Runs a `/` command. The composer knows what was typed; only `main.tsx` can act on it. */
	onCommand: (command: NonNullable<Suggestion["command"]>) => void;
}) {
	const [text, setText] = useState("");
	const box = useRef<HTMLTextAreaElement | null>(null);
	/**
	 * Where the caret was at the last keystroke.
	 *
	 * Read from the element rather than tracked in state on every change: React does not
	 * re-render between a keydown and the browser moving the caret, so state would always be
	 * one keystroke behind exactly when the menu needs to be right.
	 */
	const [caret, setCaret] = useState(0);
	/** Which row the arrow keys are on. Reset whenever the list itself changes. */
	const [active, setActive] = useState(0);
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

	// Recomputed every render rather than kept in state: it is a pure function of the text
	// and the caret, and a second copy in state is a second thing that can be stale at the
	// exact moment the menu is on screen.
	const trigger = blocked ? null : triggerAt(text, caret);
	const suggestions = trigger ? suggestionsFor(trigger, Object.values(state.nodes)) : [];
	const open = suggestions.length > 0;
	const chosen = suggestions[Math.min(active, suggestions.length - 1)];

	function accept(suggestion: Suggestion) {
		if (suggestion.command) {
			setText("");
			onCommand(suggestion.command);
			return;
		}
		if (!trigger) return;
		const next = applySuggestion(text, trigger, suggestion);
		setText(next.text);
		setActive(0);
		// After React has written the new value, or the browser puts the caret at the end of
		// it — which for a reference inserted mid-sentence is the wrong end.
		requestAnimationFrame(() => {
			box.current?.setSelectionRange(next.caret, next.caret);
			setCaret(next.caret);
		});
	}

	function send() {
		const trimmed = text.trim();
		if (!trimmed || blocked) return;
		onSend(trimmed, target);
		setText("");
	}

	return (
		<div className="composer">
			{/* No sentence explaining why this window cannot be typed into — the textarea's own
			    placeholder already says it, in the place a person is looking when they try.
			    What stays is the way out: the point this line actually moved on to. */}
			{node && !live && ahead && (
				<div className="row">
					<button type="button" onClick={() => onSelect(ahead)}>
						go to the live point ({state.nodes[ahead]?.agent})
					</button>
				</div>
			)}

			{/* Only while it is working. Idle needs no label: the box you are typing into is
			    the box, and naming its recipient above every keystroke captions something
			    already on screen. Busy is the one moment there is news here, and the stop
			    button belongs beside that news rather than on its own line. */}
			{busy && (
				<div className="row">
					<span className="hint">
						{node?.agent ?? "it"} ({node?.id ?? "…"}) is working
					</span>
					<span className="hint targetHint">{describeTarget(target)}</span>
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
				</div>
			)}

			{/* Above the box, not below it: the box sits at the bottom of the window, and a
			    menu drawn under it would open off-screen. */}
			{open && (
				<div className="complete">
					{suggestions.map((suggestion, index) => (
						<button
							type="button"
							key={suggestion.id}
							className={`completeRow${suggestion === chosen ? " active" : ""}`}
							// `onMouseDown`, not `onClick`: a click moves focus out of the textarea
							// first, which closes the menu before the click ever lands.
							onMouseDown={(event) => {
								event.preventDefault();
								accept(suggestion);
							}}
							onMouseEnter={() => setActive(index)}
						>
							<span className="completeLabel">{suggestion.label}</span>
							<span className="completeDetail">{suggestion.detail}</span>
						</button>
					))}
				</div>
			)}

			<textarea
				ref={box}
				value={text}
				placeholder={
					!state.connected
						? "not connected"
						: !state.rootId
							? "starting this conversation…"
							: state.fixed?.restored
								? "this conversation ended when its process stopped — nothing can be sent to it"
								: !live
									? `this window is ${node?.state === "aborted" ? "stopped" : node?.state === "failed" ? "failed" : "closed"} — nothing can be sent to it`
									: busy
										? `${node?.agent} is working — this reaches it before its next thought`
										: exampleId
											? `say something — enter sends, shift+enter for a new line. @${exampleId} quotes that point`
											: "say something — enter sends, shift+enter for a new line"
				}
				disabled={blocked}
				onChange={(event) => {
					setText(event.target.value);
					setCaret(event.target.selectionStart ?? event.target.value.length);
					setActive(0);
				}}
				// Every way the caret can move without the text changing — arrows, clicks,
				// Home/End. Without this the menu keeps offering completions for a token the
				// caret has already left.
				onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
				onBlur={() => setCaret(-1)}
				onKeyDown={(event) => {
					// While the menu is open it owns the keys it needs, and only those. Enter
					// is the one that matters: it means "take this row" here and "send" the
					// rest of the time, and getting that backwards either sends a half-typed
					// `@n` or makes the menu impossible to accept from the keyboard.
					if (open && !event.nativeEvent.isComposing) {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setActive((index) => (index + 1) % suggestions.length);
							return;
						}
						if (event.key === "ArrowUp") {
							event.preventDefault();
							setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
							return;
						}
						if (event.key === "Enter" || event.key === "Tab") {
							event.preventDefault();
							if (chosen) accept(chosen);
							return;
						}
						if (event.key === "Escape") {
							event.preventDefault();
							// Closes the menu without touching the text: the token stays, so a
							// person who meant to type a literal `@` can carry on typing it.
							setCaret(-1);
							return;
						}
					}
					// Enter sends; Shift+Enter (and the IME's own Enter, which arrives with
					// `isComposing` set while a person is still picking characters) does not.
					// Guarding on `isComposing` matters here specifically: without it, typing
					// Chinese or Japanese fires a send on the Enter that only meant "accept
					// this candidate", mid-word.
					if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
						event.preventDefault();
						send();
					}
				}}
			/>

			{unknown.length > 0 && (
				<div className="row">
					<span className="warn">
						no such point: {unknown.join(", ")} — it will be sent as plain text
					</span>
				</div>
			)}
		</div>
	);
}
