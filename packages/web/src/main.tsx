import { StrictMode, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ClientFrame, ServerFrame, Target } from "@lumen/server/protocol";
import { Composer } from "./Composer.tsx";
import { Canvas } from "./Canvas.tsx";
import { Files } from "./Files.tsx";
import { IdeaGraph } from "./IdeaGraph.tsx";
import { Detail } from "./Detail.tsx";
import { Settings } from "./Settings.tsx";
import { Conversations } from "./Conversations.tsx";
import { money } from "@lumen/kernel/trace/types";
import { initialState, reduce } from "./state.ts";
import "./app.css";

/**
 * `<main>`'s four columns, measured at 1440px with the files pane open and the graphs
 * column at its default width: files 220px | reading 895px | handle 5px | graphs 320px.
 * Three reviewers at this width independently named the same complaint — the conversation,
 * the thing a person actually reads, was the narrowest pane on screen (420px of 1440, 29%)
 * while the biggest pane held one placeholder sentence for a whole run. This layout answers
 * that by swapping which column is `1fr`: the reading column (`.side`, holding `Detail` and
 * `Composer`) now takes the width that used to belong to whichever canvas was toggled on,
 * so it is the dominant pane by construction — wider than the graphs column not only at
 * 1440px but at every width down to where a side-by-side layout stops making sense at all
 * (see the `panel` state's own comment below for the arithmetic) — rather than by tuning a
 * number that the next content change would un-tune again.
 *
 * The toggle that used to pick one canvas or the other is gone. Both render at once, in
 * one shared right-hand column (`.graphs`), split into two rows rather than two side-by-side
 * panes: the findings graph is — by `IdeaGraph.tsx`'s own doc comment — expected to "stay
 * small and shallow", so it is given a capped top row with its own scroll; the call graph is
 * a pan/zoom canvas that is only useful with real screen space, so it gets the row underneath
 * with the majority of the column's height rather than a fixed sliver. A tab strip was the
 * other candidate and was rejected: it would have recreated exactly the "the thing you just
 * got hides the thing that's still running" problem this task exists to remove, just with a
 * different control drawing the curtain.
 *
 * The drag handle is untouched in behaviour — it still measures from the right edge of the
 * window and still writes to `lumen.panel` — but what it resizes changed with the swap: it
 * used to widen the reading column, and now widens the graphs column instead. That is the
 * same physical gesture (the handle sits in the same place, between the dominant centre pane
 * and the narrower side one) doing the same job for a column that now holds different
 * content, not a handle quietly repointed at something a person watching the cursor would not
 * expect.
 *
 * The files pane keeps its own collapse toggle, unchanged, as the leading column.
 */
function App() {
	const [state, dispatch] = useReducer(reduce, initialState);
	const [showSettings, setShowSettings] = useState(false);
	const [showConversations, setShowConversations] = useState(false);
	/** Whether the file browser fills the leading slot of `<main>`, or is collapsed to it. */
	const [filesOpen, setFilesOpen] = useState(true);
	/**
	 * How wide the graphs column (the findings graph stacked over the call graph) is.
	 *
	 * It was a third of the window and belonged to the reading pane; the reading pane is now
	 * `1fr` and dominant by construction (see the layout comment above `App`), and this
	 * measurement moved to the column beside it. The name and the storage key stay as they
	 * were — this is still "the width of whichever column sits right of the handle", just a
	 * different column's content now — so a person's saved width carries over instead of
	 * silently resetting the first time this ships.
	 *
	 * The default is 320, the same number the handle has always floored a drag at, not the
	 * 420 the reading pane used to default to. That number was picked for paragraphs and
	 * quotations; this column holds short titles and a canvas, and it has a second job the
	 * old one didn't: with the files column's fixed 220px, anything wider than roughly a
	 * third of a 900px-ish window leaves the reading pane — the pane this whole layout
	 * exists to protect — narrower than the column beside it before anyone has dragged
	 * anything. 320 keeps that true down to about 865px unresized; the resize-clamp effect
	 * below is what keeps it true below that, and the media queries in `app.css` take over
	 * once the window is too narrow for a side-by-side layout at all.
	 */
	const [panel, setPanel] = useState(() => {
		const saved = Number(localStorage.getItem("lumen.panel"));
		return Number.isFinite(saved) && saved >= 320 ? saved : 320;
	});
	const dragging = useRef(false);
	const socket = useRef<WebSocket | null>(null);

	const nodeCount = Object.keys(state.nodes).length;
	// Every point's figure is inclusive of what is under it, so adding the column up
	// multiplies the truth. This is the only number that is the run.
	const spent = Object.values(state.nodes).reduce((sum, node) => sum + node.usage.cost.total, 0);
	const empty = nodeCount <= 1 && !state.nodes[state.rootId ?? ""]?.summary;

	useEffect(() => {
		// A stable id, kept in the browser, is what makes a refresh survivable: the server
		// hands back the same conversation instead of starting an empty one. Without it,
		// reloading silently threw away the whole graph — including lines still running.
		let key = localStorage.getItem("lumen.session");
		if (!key) {
			key = `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
			localStorage.setItem("lumen.session", key);
		}
		const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?s=${key}`;
		const ws = new WebSocket(url);
		socket.current = ws;
		ws.onopen = () => dispatch({ kind: "connection", connected: true });
		ws.onclose = () => dispatch({ kind: "connection", connected: false });
		ws.onmessage = (event) =>
			dispatch({ kind: "frame", frame: JSON.parse(event.data) as ServerFrame });
		return () => ws.close();
	}, []);

	// On the window rather than on the handle: a pointer moving faster than React re-renders
	// leaves the handle behind, and a drag that stops the moment the cursor outruns it reads
	// as a broken control.
	useEffect(() => {
		const move = (event: MouseEvent) => {
			if (!dragging.current) return;
			event.preventDefault();
			const from = window.innerWidth - event.clientX;
			setPanel(Math.round(Math.min(Math.max(320, from), window.innerWidth * 0.7)));
		};
		const up = () => {
			dragging.current = false;
			document.body.classList.remove("resizing");
		};
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
		return () => {
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
		};
	}, []);

	useEffect(() => {
		localStorage.setItem("lumen.panel", String(panel));
	}, [panel]);

	// A width saved from a wide window can be wider than a window it is then read back into
	// — nobody dragged anything, the window just changed shape (or a saved width from before
	// this file's layout changed is still sitting in storage) — and the same clamp the drag
	// itself already enforces has to run again or that saved number pushes the reading column
	// out before a person ever touches the handle. The ceiling is tighter than the drag's own
	// 70%: half of what is left once the files column is accounted for, so a settled width —
	// on load, or after a resize — never leaves the graphs column wider than the reading pane
	// beside it, the one hard requirement this layout exists to satisfy. A drag in progress is
	// exempt on purpose (it uses its own ceiling above, unchanged) — the person can still push
	// the graphs column past dominance while actually dragging, the same freedom this handle
	// always gave; this effect only guards what a load or a resize settles on once the pointer
	// is back up. Below 900px the layout's own media queries take the grid over from this
	// inline width entirely (see app.css), so this is only load-bearing at the widths this
	// component actually controls.
	useEffect(() => {
		const clamp = () => {
			const filesWidth = filesOpen ? 220 : 0;
			const available = window.innerWidth - filesWidth - 5;
			const ceiling = Math.max(320, Math.min(window.innerWidth * 0.7, Math.floor(available / 2)));
			setPanel((width) => Math.round(Math.min(Math.max(320, width), ceiling)));
		};
		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
		// `filesOpen` too: the files column's width is half of what decides the ceiling, and
		// opening or closing it is exactly the kind of "the window just changed shape" this
		// effect exists to react to, not only an actual `resize` event.
	}, [filesOpen]);

	const send = useCallback(
		(frame: ClientFrame) => socket.current?.send(JSON.stringify(frame)),
		[],
	);

	const say = useCallback(
		(text: string, target: Target) => {
			const nodeId = state.selected;
			if (!nodeId) return;
			// Echo locally rather than waiting for it to come back. The server has no event
			// for "the person said something" — the trace records what agents did — and a
			// message that only appears once the model replies reads as a dropped keystroke.
			//
			// Only for the targets this window actually receives. A handed-over or sent-off
			// sentence goes to a point that does not exist yet, and drawing it here said
			// this agent had been spoken to when it never was — contradicted a line below by
			// the very step that recorded where the sentence really went.
			// Notices describe the action you just took. Leaving the previous one on screen
			// beside the new one made a stale line read as a second, current complaint.
			dispatch({ kind: "clearMessages" });
			if (
				target.kind === "continue" ||
				target.kind === "next" ||
				target.kind === "queue" ||
				target.kind === "cutIn"
			) {
				dispatch({ kind: "said", nodeId, text });
			}
			send({ type: "say", nodeId, text, target });
		},
		[send, state.selected],
	);

	/**
	 * Close this conversation and come back to an empty page.
	 *
	 * The reload has to wait for the socket to go, not fire beside it. A frame sent into a
	 * page that is already navigating away is a frame the server never reads, and the
	 * conversation it was supposed to close would keep its lines open — and, if it was
	 * running by itself, keep spending in a window nobody can reach any more.
	 */
	const newConversation = useCallback(() => {
		const ws = socket.current;
		localStorage.removeItem("lumen.session");
		localStorage.removeItem("lumen.selected");
		const reload = () => location.reload();
		if (!ws || ws.readyState !== WebSocket.OPEN) return reload();
		ws.addEventListener("close", reload, { once: true });
		// The fallback, for a socket that dies without closing cleanly. Better a fresh page
		// than a button that does nothing.
		setTimeout(reload, 1000);
		ws.send(JSON.stringify({ type: "close" } satisfies ClientFrame));
	}, []);

	/**
	 * Leave this conversation for a different one the server already holds, without ending
	 * either. See `Conversations.tsx` for why this exists: a tab with no memory of a running
	 * conversation has to be able to reach it some way other than guessing its key.
	 *
	 * No `close` frame goes out, deliberately — that is what `newConversation` sends, and it
	 * ends the conversation it is called on. Leaving one tab's view of a conversation is not
	 * the same act as ending the conversation, and this reload is a plain refresh in every
	 * way but which key it reads: the socket that closes on navigation only detaches the
	 * conversation this tab was looking at, exactly as a reload without a target key does.
	 */
	const switchTo = useCallback((key: string) => {
		localStorage.setItem("lumen.session", key);
		localStorage.removeItem("lumen.selected");
		location.reload();
	}, []);

	const abort = useCallback(() => {
		if (state.selected) send({ type: "abort", nodeId: state.selected });
	}, [send, state.selected]);

	/** Ask for one step's whole result. Marks it loading locally, then sends the request. */
	const fetchFullStep = useCallback(
		(nodeId: string, stepId: string) => {
			dispatch({ kind: "step.full.request", stepId });
			send({ type: "step.full", nodeId, stepId });
		},
		[send],
	);

	/**
	 * Bring the file browser column into view.
	 *
	 * What a clicked ref in `Detail.tsx`'s prose does before asking for the file it names —
	 * see `Prose.tsx`'s `Opener`. Without this, a click while the column was collapsed sent
	 * the read and the answer landed in `state.files.preview`, but nothing on screen showed
	 * it: the same file, open in a pane nobody could see.
	 */
	const revealFiles = useCallback(() => setFilesOpen(true), []);

	return (
		<div className="app">
			<header>
				<strong>lumen</strong>
				<span className="hint">a point is one context window — click one to talk to it</span>
				{/* The glyphs carry the only distinction that matters while work is running,
				    and two of them differ by a few pixels at this size. Spell them out. */}
				<span className="legend">
					<span>◍ working</span>
					<span>• idle, talk to it</span>
					<span>✓ done</span>
					<span>■ stopped</span>
					<span>✗ failed</span>
				</span>
				<label className="auto" title="the lead keeps working until it says it is done, or the budget runs out">
					<input
						type="checkbox"
						checked={state.auto.on}
						disabled={!state.connected}
						onChange={(event) => send({ type: "auto", on: event.target.checked })}
					/>
					run by itself
				</label>
				{/* Only once a turn has actually been taken. Between switching on and the first
				    automatic turn the count is zero, and "turn 0" reads as a fault. */}
				{state.auto.on && state.auto.turns > 0 && (
					<span className="meta">turn {state.auto.turns}</span>
				)}
				<span className="meta" title="every window's own spend, added once">
					{money(spent)}
					{state.settings ? ` of ${money(state.settings.autoBudget)}` : ""} this run
				</span>
				<button type="button" className="link" onClick={() => setFilesOpen((on) => !on)}>
					{filesOpen ? "hide files" : "show files"}
				</button>
				{/* Shown only when there is something to say. A count of zero would be true on
				    every conversation ever started and would teach people to stop reading it. */}
				{state.otherConversations > 0 && (
					<button type="button" className="link warn" onClick={() => setShowConversations(true)}>
						{state.otherConversations === 1
							? "1 other conversation"
							: `${state.otherConversations} other conversations`}
					</button>
				)}
				<button type="button" className="link" onClick={() => setShowSettings(true)}>
					settings
				</button>
				<span className={`dot ${state.connected ? "on" : "off"}`} />
			</header>

			{showSettings && state.settings && state.fixed && (
				<Settings
					settings={state.settings}
					fixed={state.fixed}
					onChange={(patch) => send({ type: "settings", patch })}
					onClose={() => setShowSettings(false)}
					onNewConversation={newConversation}
				/>
			)}

			{showConversations && (
				<Conversations
					conversations={state.conversations}
					onRequest={() => send({ type: "conversations.list" })}
					onRejoin={switchTo}
					onClose={() => setShowConversations(false)}
				/>
			)}

			<main
				style={{
					// A fixed width when open, and near-zero when not — collapsed rather than
					// removed, so the column the toggle controls still exists to be reopened
					// without the grid itself changing shape underneath the person's cursor.
					// Below 900px app.css takes this over with `!important` media rules — see
					// the layout comment above `App` — so this value only governs the width
					// this component's own drag handle and toggle actually control.
					gridTemplateColumns: `${filesOpen ? "220px" : "0px"} 1fr 5px ${panel}px`,
				}}
			>
				<div className="filesCol">
					<Files state={state} send={send} />
				</div>

				{/* The dominant pane: what you're reading, on top of what you'd type into it.
				    This used to be the narrow side column; it is `1fr` now, and everything
				    else on the page was resized around that, not the other way round. */}
				<div className="side">
					{/* Persistent, not a `notice` — a notice scrolls off after a few messages
					    (see `state.messages.slice(-3)` below), and this has to stay true on
					    screen for as long as the page does. `state.fixed.restored` comes from
					    the server's own `hello`: this is a saved record, read back after the
					    process that ran it ended, not a run this page can continue. */}
					{state.fixed?.restored && (
						<div className="historyNotice">
							<span>
								This is a saved record of a conversation whose process ended. Its agents no
								longer exist, so nothing here can be sent, stopped, or changed — but everything
								it did, including the files it produced, can still be read.
							</span>
							<button type="button" className="link" onClick={newConversation}>
								start a fresh conversation
							</button>
						</div>
					)}

					<Detail state={state} send={send} onFetchFull={fetchFullStep} onRevealFiles={revealFiles} />

					{/* The failure this exists to stop: a tab that opens with no memory of a running
					    conversation reads as "nothing has happened here yet," and a person who trusts
					    that look can walk away from a run that is still going, and still spending,
					    somewhere this tab has no way to name on its own. Shown only for an empty
					    conversation — a tab already mid-conversation is plainly not the orphan. */}
					{empty && state.otherConversations > 0 && (
						<div className="orphanNotice">
							This looks like a fresh conversation, but the server is holding{" "}
							{state.otherConversations === 1 ? "another one" : `${state.otherConversations} others`}{" "}
							too — possibly still running, possibly still spending. If you expected to land
							back in one you already started, do not ask this one anything yet.{" "}
							<button type="button" className="link" onClick={() => setShowConversations(true)}>
								see them
							</button>
						</div>
					)}

					{empty && (
						<div className="blank">
							Ask for something that has parts, and watch the work spread out. Each box is
							one agent's context window: a drop is work sent out, a run to the right is
							one conversation continuing. Turn on <em>run by itself</em> once you have
							asked, and the lead keeps going — delegating, reading what came back,
							deciding what is still missing — until it says it is done or the budget stops
							it.
						</div>
					)}

					{state.messages.length > 0 && (
						<div className="messages">
							{state.messages.slice(-3).map((message, index) => (
								<div className={message.level} key={index}>
									{message.text}
								</div>
							))}
						</div>
					)}

					<Composer
						state={state}
						onSend={say}
						onAbort={abort}
						onSelect={(nodeId) => dispatch({ kind: "select", nodeId })}
					/>
				</div>

				{/* Keyboard-reachable, because a drag is the only other way to move it and a
				    person who cannot drag would be left with whatever width they were given. */}
				<div
					className="handle"
					role="separator"
					aria-orientation="vertical"
					aria-label="width of the graphs panel"
					tabIndex={0}
					onMouseDown={() => {
						dragging.current = true;
						document.body.classList.add("resizing");
					}}
					onKeyDown={(event) => {
						const step = event.shiftKey ? 80 : 20;
						if (event.key === "ArrowLeft") setPanel((w) => Math.min(window.innerWidth * 0.7, w + step));
						if (event.key === "ArrowRight") setPanel((w) => Math.max(320, w - step));
					}}
				/>

				{/* The findings graph and the call graph, stacked rather than toggled — see the
				    layout comment above `App` for why a shared column split this way, instead
				    of a tab strip, is what lets both stay visible while a run is going. */}
				<div className="graphs">
					<div className="findingsPane">
						<div className="paneHead">findings</div>
						{state.rootId ? (
							<IdeaGraph state={state} onSelect={(nodeId) => dispatch({ kind: "select", nodeId })} />
						) : (
							<p className="hint">waiting for the run to open…</p>
						)}
					</div>
					<div className="callPane">
						<div className="paneHead">call graph</div>
						{state.rootId ? (
							<Canvas state={state} onSelect={(nodeId) => dispatch({ kind: "select", nodeId })} />
						) : (
							<p className="hint">waiting for the run to open…</p>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
