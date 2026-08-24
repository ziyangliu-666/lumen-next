import { StrictMode, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ClientFrame, ServerFrame, Target } from "@lumen/server/protocol";
import { Composer } from "./Composer.tsx";
import { Canvas } from "./Canvas.tsx";
import { Detail } from "./Detail.tsx";
import { Settings } from "./Settings.tsx";
import { money } from "@lumen/kernel/trace/types";
import { initialState, reduce } from "./state.ts";
import "./app.css";

function App() {
	const [state, dispatch] = useReducer(reduce, initialState);
	const [showSettings, setShowSettings] = useState(false);
	/**
	 * How wide the reading panel is.
	 *
	 * It was a third of the window, which is right for a two-line answer and wrong for the
	 * thing this is for: a research run ends in several paragraphs with paths and quotations
	 * in them, and a fixed narrow column turns that into a ribbon. The canvas and the reading
	 * want opposite amounts of room at different moments, so the person gets to say.
	 */
	const [panel, setPanel] = useState(() => {
		const saved = Number(localStorage.getItem("lumen.panel"));
		return Number.isFinite(saved) && saved >= 320 ? saved : 420;
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

	const abort = useCallback(() => {
		if (state.selected) send({ type: "abort", nodeId: state.selected });
	}, [send, state.selected]);

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

			<main style={{ gridTemplateColumns: `1fr 5px ${panel}px` }}>
				{state.rootId ? (
					<Canvas state={state} onSelect={(nodeId) => dispatch({ kind: "select", nodeId })} />
				) : (
					<p className="hint">waiting for the run to open…</p>
				)}
				{/* Keyboard-reachable, because a drag is the only other way to move it and a
				    person who cannot drag would be left with whatever width they were given. */}
				<div
					className="handle"
					role="separator"
					aria-orientation="vertical"
					aria-label="width of the reading panel"
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
				{/* The reading panel and the box you type into are one column now: what you
				    say goes to the point you are reading, so the box sits directly under it
				    rather than spanning a width that includes the canvas it has nothing to do
				    with. */}
				<div className="side">
					<Detail state={state} />

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
			</main>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
