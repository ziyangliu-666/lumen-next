import { StrictMode, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ClientFrame, ServerFrame, Target } from "@lumen/server/protocol";
import { Composer } from "./Composer.tsx";
import { CallTree } from "./CallTree.tsx";
import { Files } from "./Files.tsx";
import { IdeaGraph } from "./IdeaGraph.tsx";
import { Detail } from "./Detail.tsx";
import { Settings } from "./Settings.tsx";
import { Conversations } from "./Conversations.tsx";
import { money } from "@lumen/kernel/trace/types";
import { initialState, reduce } from "./state.ts";
import "./app.css";

/**
 * The floors on the two halves of the graphs column, in pixels.
 *
 * Not the same number, because they fail differently. Findings are cards in a list: at 120px
 * one card and the pane's own heading still read, and a list that has to be scrolled is a
 * list, not a broken pane. The call graph is a canvas you pan and zoom, and a canvas shorter
 * than a couple of node boxes is not a small graph — it is a strip with nothing legible in
 * it, which is the failure a minimum is supposed to prevent rather than merely postpone.
 */
const FINDINGS_MIN = 120;
const CALL_GRAPH_MIN = 180;

/**
 * Where a conversation lives, read from the one place that has ever been true: the address
 * bar. `/` is the list of every conversation this operator can reach — see `Landing` below.
 * `/c/<key>` is one conversation, and `<key>` is exactly the string that used to live only in
 * `lumen.session` and a `?s=` nobody read back — see this file's own history for why that was
 * the bug. Anything else (a stray path, a link copied wrong) falls back to the list rather
 * than erroring: `serveStatic` on the server already answers every unrecognised path with
 * `index.html` so a hard reload survives, and this is the same forgiveness on the client side
 * of that same fallback.
 */
type Route = { kind: "list" } | { kind: "conversation"; key: string };

function parseRoute(pathname: string): Route {
	const match = pathname.match(/^\/c\/([^/]+)\/?$/);
	return match ? { kind: "conversation", key: decodeURIComponent(match[1]) } : { kind: "list" };
}

/**
 * A fresh identity for a conversation that does not exist yet, chosen in the browser. The
 * server never hands one out — see `packages/server/src/index.ts`'s connection handler and
 * its `start` frame — so whoever begins a conversation is whoever names it, the same way a
 * `lumen.session` id used to be minted the first time a tab needed one.
 */
function generateKey(): string {
	return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/**
 * The whole app is routing plus exactly one of two pages: `Landing` at `/`, or one
 * `Conversation` at `/c/<key>`. No router dependency — this package has almost none, and two
 * paths do not need one — just `history.pushState` and a `popstate` listener, both here.
 *
 * `pendingFirstMessage` is the one piece of state routing alone cannot carry: `Landing`'s own
 * composer types a sentence before any key exists to send it to, mints the key, and pushes
 * straight to `/c/<key>` — the sentence has to ride along outside the URL for that one hop,
 * from `Landing` to the `Conversation` that is about to open a socket for the same key. Every
 * other way of reaching a conversation (rejoining one, following a link, pressing back) passes
 * none, which is what stops a stale draft from ever being replayed against a conversation it
 * was never meant for.
 */
function App() {
	const [route, setRoute] = useState<Route>(() => parseRoute(location.pathname));
	const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);

	// Back and forward move between whatever routes are already in history — including two
	// different conversations — and this is the one thing that has to notice: `history` itself
	// already changed `location.pathname`, so there is nothing to push, only to read.
	useEffect(() => {
		const onPopState = () => {
			setRoute(parseRoute(location.pathname));
			setPendingFirstMessage(null);
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	/** The one place a URL changes on purpose. See this function's own doc comment for why
	 * `firstMessage` is the exception rather than the rule. */
	const navigate = useCallback((path: string, firstMessage?: string) => {
		history.pushState(null, "", path);
		setRoute(parseRoute(path));
		setPendingFirstMessage(firstMessage ?? null);
	}, []);

	if (route.kind === "list") {
		return <Landing onNavigate={navigate} />;
	}

	// `key={route.key}`: React unmounts and remounts `Conversation` whenever the key itself
	// changes, instead of patching the same instance onto a different conversation. That is
	// exactly what switching conversations needs — a fresh socket, a fresh reducer, nothing
	// left over from whichever conversation was open a moment ago — and it is what makes back
	// and forward between two conversations work with no extra code at all: `popstate` above
	// already updates `route`, and the key change does the rest.
	return (
		<Conversation
			key={route.key}
			routeKey={route.key}
			initialMessage={pendingFirstMessage}
			onNavigate={navigate}
		/>
	);
}

/**
 * `/`: every conversation this operator can reach, and a place to start one. This used to be
 * a modal reached from inside a conversation — see `Conversations.tsx`, whose `page` prop is
 * what lets the same component be both — and it is the landing page now because there was
 * never anywhere else to land: opening the app used to drop you straight into a conversation
 * a page load had just minted on the server, whether or not you ever said a word to it.
 *
 * Its own socket, separate from any `Conversation`'s: this one carries no `?s=` at all, so the
 * server's connection handler falls back to an anonymous key nothing is ever created under
 * (see that handler's own comment) — this page only ever sends `conversations.list`, never
 * `start`, so lazy creation holds here exactly as it does everywhere else.
 */
function Landing({ onNavigate }: { onNavigate: (path: string, firstMessage?: string) => void }) {
	const [state, dispatch] = useReducer(reduce, initialState);
	const socket = useRef<WebSocket | null>(null);
	const [text, setText] = useState("");

	useEffect(() => {
		const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
		const ws = new WebSocket(url);
		socket.current = ws;
		ws.onopen = () => {
			dispatch({ kind: "connection", connected: true });
			ws.send(JSON.stringify({ type: "conversations.list" } satisfies ClientFrame));
		};
		ws.onclose = () => dispatch({ kind: "connection", connected: false });
		ws.onmessage = (event) =>
			dispatch({ kind: "frame", frame: JSON.parse(event.data) as ServerFrame });
		return () => ws.close();
	}, []);

	function start() {
		const trimmed = text.trim();
		if (!trimmed || !state.connected) return;
		onNavigate(`/c/${encodeURIComponent(generateKey())}`, trimmed);
	}

	return (
		<div className="app">
			<header>
				<strong>lumen</strong>
				<span className="hint">a point is one context window — click one to talk to it</span>
				<span className={`dot ${state.connected ? "on" : "off"}`} />
			</header>
			<div className="landing">
				<div className="composer landingComposer">
					<textarea
						value={text}
						placeholder="say something to start a new conversation — enter sends, shift+enter for a new line"
						onChange={(event) => setText(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
								event.preventDefault();
								start();
							}
						}}
					/>
					<div className="row">
						<button type="button" disabled={!text.trim() || !state.connected} onClick={start}>
							start a new conversation
						</button>
					</div>
				</div>
				<div className="landingBody">
					<Conversations
						page
						conversations={state.conversations}
						onRequest={() =>
							socket.current?.send(JSON.stringify({ type: "conversations.list" } satisfies ClientFrame))
						}
						onRejoin={(key) => onNavigate(`/c/${encodeURIComponent(key)}`)}
						onClose={() => {}}
					/>
				</div>
			</div>
		</div>
	);
}

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
function Conversation({
	routeKey,
	initialMessage,
	onNavigate,
}: {
	/** This conversation's identity — the `<key>` in `/c/<key>` and the socket's own `?s=`. */
	routeKey: string;
	/** The sentence typed on `Landing`'s own composer, for a conversation that does not exist
	 * on the server yet — sent as `start` the instant this component's socket opens, then
	 * never again; see this file's `App` for why every other way of reaching a conversation
	 * passes `null` here instead. */
	initialMessage: string | null;
	onNavigate: (path: string, firstMessage?: string) => void;
}) {
	const [state, dispatch] = useReducer(reduce, initialState);
	const [showSettings, setShowSettings] = useState(false);
	const [showConversations, setShowConversations] = useState(false);
	/** Whether the file browser fills the leading slot of `<main>`, or is collapsed to it. */
	const [filesOpen, setFilesOpen] = useState(true);
	/**
	 * How wide the graphs column (the findings graph stacked over the call graph) is.
	 *
	 * It was a third of the window and belonged to the reading pane; the reading pane is now
	 * `1fr` and dominant by construction (see the layout comment above `Conversation`), and this
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
	/**
	 * How tall the findings half of the graphs column is, in pixels.
	 *
	 * This split was a fixed `minmax(120px, 30%)` in the stylesheet, which meant the call
	 * graph always took the rest and there was no way to give it less — the one boundary on
	 * screen a person could see and could not move. Which half wants the room is not a thing
	 * this layout can know: a run with two findings and a wide delegation tree wants the
	 * opposite of a run with twenty findings and one worker.
	 *
	 * A pixel height rather than a fraction, so dragging it moves a divider rather than
	 * nudging a ratio, and so the floors below can be stated in the terms each half actually
	 * needs — a card's worth of findings, and enough canvas to be worth panning.
	 */
	const [findings, setFindings] = useState(() => {
		const saved = Number(localStorage.getItem("lumen.findings"));
		return Number.isFinite(saved) && saved >= FINDINGS_MIN ? saved : 240;
	});
	const dragging = useRef(false);
	/**
	 * The graphs column's top edge while its divider is being dragged.
	 *
	 * Captured on mousedown rather than measured on every move: the divider is inside the
	 * column it resizes, so reading its position mid-drag would read a box that has already
	 * moved because of the drag, and the pane would chase the pointer instead of following
	 * it. The column's top does not move while a drag is going, so one reading is enough.
	 */
	const rowDragTop = useRef<number | null>(null);
	const graphsRef = useRef<HTMLDivElement | null>(null);
	const socket = useRef<WebSocket | null>(null);
	// Read once, at construction: `App`'s `key={route.key}` remounts this component fresh for
	// every conversation, so a ref captured here already holds exactly the value this mount
	// was handed, with no risk of a later, unrelated `navigate()` call changing it out from
	// under an effect that has already run.
	const initialMessageRef = useRef(initialMessage);

	const nodeCount = Object.keys(state.nodes).length;
	// Every point's figure is inclusive of what is under it, so adding the column up
	// multiplies the truth. This is the only number that is the run.
	const spent = Object.values(state.nodes).reduce((sum, node) => sum + node.usage.cost.total, 0);
	const empty = nodeCount <= 1 && !state.nodes[state.rootId ?? ""]?.summary;

	useEffect(() => {
		// The identity of this conversation is `routeKey` — the `<key>` in this page's own
		// `/c/<key>` URL — not anything read from storage. A refresh survives because the URL
		// does, the same way it always has for every other page on the web; see `App`'s own
		// doc comment for why a *different* key is a remount rather than a value this effect
		// has to react to.
		const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?s=${encodeURIComponent(routeKey)}`;
		const ws = new WebSocket(url);
		socket.current = ws;
		ws.onopen = () => {
			dispatch({ kind: "connection", connected: true });
			// The one frame this socket may send before it has ever heard a `hello`: the
			// sentence typed on `Landing`, for the key `Landing` just invented. The server has
			// created nothing for this key yet — see its connection handler's own comment on
			// lazy creation — and this is the frame that asks it to. Every message after this
			// one goes through `say`, once a real node id exists for it to carry.
			if (initialMessageRef.current !== null) {
				ws.send(JSON.stringify({ type: "start", text: initialMessageRef.current } satisfies ClientFrame));
				initialMessageRef.current = null;
			}
		};
		ws.onclose = () => dispatch({ kind: "connection", connected: false });
		ws.onmessage = (event) =>
			dispatch({ kind: "frame", frame: JSON.parse(event.data) as ServerFrame });
		return () => ws.close();
	}, [routeKey]);

	// On the window rather than on the handle: a pointer moving faster than React re-renders
	// leaves the handle behind, and a drag that stops the moment the cursor outruns it reads
	// as a broken control.
	useEffect(() => {
		const move = (event: MouseEvent) => {
			if (dragging.current) {
				event.preventDefault();
				const from = window.innerWidth - event.clientX;
				setPanel(Math.round(Math.min(Math.max(320, from), window.innerWidth * 0.7)));
				return;
			}
			// The other divider, the horizontal one inside the graphs column. Same listener,
			// because the reason these live on the window rather than on the control — a
			// pointer outrunning React — is the same reason for both.
			const top = rowDragTop.current;
			if (top === null) return;
			event.preventDefault();
			const height = graphsRef.current?.getBoundingClientRect().height ?? 0;
			// The floor for the call graph is what caps findings, so the two constraints are
			// one expression and cannot disagree about who owns the last pixel.
			const ceiling = Math.max(FINDINGS_MIN, height - CALL_GRAPH_MIN);
			setFindings(Math.round(Math.min(Math.max(FINDINGS_MIN, event.clientY - top), ceiling)));
		};
		const up = () => {
			dragging.current = false;
			rowDragTop.current = null;
			document.body.classList.remove("resizing");
			document.body.classList.remove("resizingRow");
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

	useEffect(() => {
		localStorage.setItem("lumen.findings", String(findings));
	}, [findings]);

	// A height saved from a tall window, read back into a short one, is the same problem the
	// width clamp below solves and needs the same answer: re-run the drag's own ceiling
	// against the column as it actually is now, so a number from a 27-inch monitor cannot
	// leave a laptop with a call graph too short to draw anything in.
	useEffect(() => {
		const clamp = () => {
			const height = graphsRef.current?.getBoundingClientRect().height ?? 0;
			if (height === 0) return;
			const ceiling = Math.max(FINDINGS_MIN, height - CALL_GRAPH_MIN);
			setFindings((current) => Math.round(Math.min(Math.max(FINDINGS_MIN, current), ceiling)));
		};
		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
	}, []);

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
	 * Close this conversation and come back to the list.
	 *
	 * Navigating away has to wait for the socket to go, not fire beside it. A frame sent into
	 * a page that is already navigating away is a frame the server never reads, and the
	 * conversation it was supposed to close would keep its lines open — and, if it was
	 * running by itself, keep spending in a window nobody can reach any more.
	 */
	const newConversation = useCallback(() => {
		const ws = socket.current;
		localStorage.removeItem("lumen.selected");
		const home = () => onNavigate("/");
		if (!ws || ws.readyState !== WebSocket.OPEN) return home();
		ws.addEventListener("close", home, { once: true });
		// The fallback, for a socket that dies without closing cleanly. Better the list than
		// a button that does nothing.
		setTimeout(home, 1000);
		ws.send(JSON.stringify({ type: "close" } satisfies ClientFrame));
	}, [onNavigate]);

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
				{/* The one way back to the list from inside a conversation, besides the browser's
				    own back button — see `App`'s `navigate` and `Landing` above. */}
				<button type="button" className="brand" onClick={() => onNavigate("/")}>
					lumen
				</button>
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
					onRejoin={(key) => {
						// See `Conversations.tsx` for why this exists: a tab with no memory of a
						// running conversation has to be able to reach it some way other than
						// guessing its key. No `close` frame goes out — that is what
						// `newConversation` sends, and it ends the conversation it is called on;
						// leaving one tab's view of a conversation for another is not the same
						// act as ending either of them.
						localStorage.removeItem("lumen.selected");
						onNavigate(`/c/${encodeURIComponent(key)}`);
						setShowConversations(false);
					}}
					onClose={() => setShowConversations(false)}
				/>
			)}

			<main
				style={{
					// A fixed width when open, and near-zero when not — collapsed rather than
					// removed, so the column the toggle controls still exists to be reopened
					// without the grid itself changing shape underneath the person's cursor.
					// Below 900px app.css takes this over with `!important` media rules — see
					// the layout comment above `Conversation` — so this value only governs the width
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
						onCommand={(command) => {
							// Each of these is otherwise a control the composer cannot reach —
							// two of them behind a modal, one only visible while something is
							// running. Nothing here shadows a button that is already on screen.
							if (command === "new") newConversation();
							if (command === "stop") abort();
							if (command === "settings") setShowSettings(true);
							if (command === "conversations") setShowConversations(true);
						}}
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
				    layout comment above `Conversation` for why a shared column split this way, instead
				    of a tab strip, is what lets both stay visible while a run is going. */}
				<div
					className="graphs"
					ref={graphsRef}
					style={{ gridTemplateRows: `${findings}px 5px minmax(0, 1fr)` }}
				>
					<div className="findingsPane">
						<div className="paneHead">findings</div>
						{state.rootId ? (
							<IdeaGraph state={state} onSelect={(nodeId) => dispatch({ kind: "select", nodeId })} />
						) : (
							<p className="hint">waiting for the run to open…</p>
						)}
					</div>
					{/* The same control as the vertical handle, turned ninety degrees — and it
					    exists for the same reason: which of these two halves deserves the room
					    depends on the run, and only the person watching it knows. */}
					<div
						className="handle row"
						role="separator"
						aria-orientation="horizontal"
						aria-label="height of the findings pane"
						tabIndex={0}
						onMouseDown={(event) => {
							rowDragTop.current = graphsRef.current?.getBoundingClientRect().top ?? null;
							document.body.classList.add("resizing");
							document.body.classList.add("resizingRow");
							event.preventDefault();
						}}
						onKeyDown={(event) => {
							const step = event.shiftKey ? 80 : 20;
							const height = graphsRef.current?.getBoundingClientRect().height ?? 0;
							const ceiling = Math.max(FINDINGS_MIN, height - CALL_GRAPH_MIN);
							if (event.key === "ArrowUp") setFindings((h) => Math.max(FINDINGS_MIN, h - step));
							if (event.key === "ArrowDown") setFindings((h) => Math.min(ceiling, h + step));
						}}
					/>
					<div className="callPane">
						<div className="paneHead">call graph</div>
						{/* Rows, not the canvas — see `CallTree.tsx` for why a 320px column is the
						    wrong place for a thing you pan. `Canvas.tsx` is untouched and still
						    reads the same state, for whoever wants the shape back. */}
						{state.rootId ? (
							<CallTree state={state} onSelect={(nodeId) => dispatch({ kind: "select", nodeId })} />
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
