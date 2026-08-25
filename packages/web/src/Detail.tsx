/**
 * One point, in full.
 *
 * The canvas answers "what is the shape of this run"; this answers "what happened in this
 * window". Splitting them is what let the canvas become a canvas: everything that has to
 * be read word by word lives here, so a point on the graph can stay the size of a point.
 */

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ClientFrame } from "@lumen/server/protocol";
import type { Step, TraceNode } from "@lumen/kernel";
import { money } from "@lumen/kernel/trace/types";
import { formatDuration, useWorked } from "./elapsed.ts";
import { Prose, type Opener } from "./Prose.tsx";
import { groupSteps, type StepRun } from "./steps.ts";
import { chatChain, hasDelegated, isLive, rollup, type State } from "./state.ts";

/** Asks the server for one step's whole result — `nodeId` is where it lives, `stepId` which one. */
type FetchFull = (nodeId: string, stepId: string) => void;

const MARK: Record<string, string> = { done: "✓", failed: "✗", aborted: "■", running: "•" };

/**
 * The marker on a step that is actively running — never `MARK.running`, and never the
 * node-level `"◍"` either.
 *
 * `MARK.running` ("•") is the header legend's "idle, talk to it": it marks a *node* whose
 * state is `running` but which is not currently busy — waiting for a person to type. A step
 * in the `running` state means the opposite of that — a tool call has been sent and has not
 * come back — so painting it with the same glyph told a person scanning the list two
 * contradictory things with one character, in the one place (a busy row, mid-run) where the
 * distinction actually matters.
 *
 * `"◍"` was the other candidate, and it is wrong for a different reason. It already has a
 * fixed meaning across the app: "this whole context window is receiving tokens right now" —
 * the header legend, the canvas point, and the idea graph's own busy badge all use it for
 * exactly that, a node-level fact. A running step is a narrower claim: one call inside the
 * current turn has not returned. The two are usually true together, which is precisely what
 * makes reusing the glyph tempting and wrong — a person could no longer tell "the model
 * itself is thinking" from "a shell command is still running underneath it" by the glyph
 * alone, only by guessing which element it happened to sit on.
 */
const STEP_RUNNING = "▶";

/** How a finished window ended, in the word a person would use for it. */
const ENDED: Record<string, string> = {
	done: "window closed",
	failed: "failed",
	aborted: "stopped",
	running: "",
};

/** Why this point exists, said plainly. */
/**
 * Take the answer away with you.
 *
 * The answer is the product, and until now the only way to keep one was to select the text
 * in a panel that rewrites itself the moment the agent says anything else. The label changes
 * to say what happened rather than flashing a tick: a person who clicked needs to know it
 * worked, and a tick that appears and vanishes is easy to miss.
 */
function Copy({ text }: { text: string }) {
	const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
	return (
		<button
			type="button"
			className="copy"
			onClick={() => {
				navigator.clipboard.writeText(text).then(
					() => setState("copied"),
					// Refused, which happens on a page the browser does not consider trusted.
					// Saying so beats a button that silently does nothing.
					() => setState("failed"),
				);
				window.setTimeout(() => setState("idle"), 2000);
			}}
		>
			{state === "idle" ? "copy" : state === "copied" ? "copied" : "could not copy"}
		</button>
	);
}

/**
 * The rest of a step's result, past what `preview` shows — fetched on demand rather than
 * carried on the step itself, so a conversation full of long tool calls does not fatten a
 * `hello` reconnect (or this panel's own re-renders) with text almost nobody asks to see.
 * See `state.ts`'s `StepFull` for the two states an id moves through once it is asked for.
 */
function FullResult({
	nodeId,
	step,
	full,
	onFetchFull,
}: {
	nodeId: string;
	step: Step;
	full: State["stepFull"][string] | undefined;
	onFetchFull: FetchFull;
}) {
	if (!full || full.status !== "done") {
		return (
			<button
				type="button"
				className="link stepFullToggle"
				disabled={full?.status === "loading"}
				onClick={() => onFetchFull(nodeId, step.id)}
			>
				{full?.status === "loading" ? "reading the rest…" : "show the rest"}
			</button>
		);
	}
	return (
		<pre className="stepFullText">
			{full.text}
			{full.truncated && (
				<div className="hint">cut at the 1&nbsp;MB this trace keeps per result — the rest is gone</div>
			)}
		</pre>
	);
}

function StepRow({
	state,
	nodeId,
	step,
	onFetchFull,
}: {
	state: State;
	nodeId: string;
	step: Step;
	onFetchFull: FetchFull;
}) {
	// Ticks only while this one step is running. A finished step's duration is already
	// baked into its own recorded text (`run.ts`'s "exit 0 in 25.6s"); there is nothing this
	// clock could add once `endedAt` is set, so the hook's `worked` argument is always 0 —
	// the whole figure comes from `busySince` counting up from `startedAt`.
	const elapsed = useWorked(0, step.state === "running" ? step.startedAt : undefined);
	return (
		<div className="step">
			<div className={`stepHead ${step.state}`}>
				<span className="mark" title={step.state}>
					{step.state === "running" ? STEP_RUNNING : MARK[step.state]}
				</span>
				<span className="title">{step.title}</span>
				{step.state === "running" && (
					<span className="stepElapsed" title="how long this call has been running">
						{formatDuration(elapsed)}
					</span>
				)}
			</div>
			{step.preview && !step.childIds?.length && <div className="preview">{step.preview}</div>}
			{/* Offered only when the recorder itself marked the preview cut short — never
			    inferred from the text, which a result that genuinely ends in "..." would fool.
			    See `Step.truncated`'s own doc comment in `@lumen/kernel`. */}
			{step.truncated && !step.childIds?.length && (
				<FullResult
					nodeId={nodeId}
					step={step}
					full={state.stepFull[step.id]}
					onFetchFull={onFetchFull}
				/>
			)}
			{step.childIds?.map((childId) => (
				<div className="spawned" key={childId}>
					{state.nodes[childId]?.agent} ({childId}) — on the canvas
				</div>
			))}
		</div>
	);
}

/**
 * One turn's reasoning, archived into the permanent record. Drawn with the same
 * `.thinking` / `.thinkingText` markup the live streaming view already uses, dim and set
 * off by a left border, rather than a tool call's tick-and-title row — it never ran
 * anything and has no state to mark.
 */
function ThinkingRow({ step, expanded }: { step: Step; expanded: boolean }) {
	const body = (
		<div className="thinking">
			<span className="thinkingLabel">thinking</span>
			{/* `archived`, not the live block: that one grows a pulsing cursor at its tail to
			    say a token could arrive any moment, and nothing here is still arriving. */}
			<div className="thinkingText archived">{step.preview}</div>
		</div>
	);
	if (expanded) return body;
	// Collapsed the same way a run of tool calls collapses: the browser's own disclosure
	// triangle, no second affordance invented beside it. The summary carries a taste of the
	// reasoning rather than the bare word "thinking" repeated once per turn the node took.
	const gist = (step.preview ?? "").replace(/\s+/g, " ").trim();
	return (
		<details className="step run">
			<summary>thinking: {gist.length > 72 ? `${gist.slice(0, 72)}…` : gist}</summary>
			{body}
		</details>
	);
}

/**
 * Which archived thinking steps render open by default, out of possibly dozens on a node
 * that has run many turns.
 *
 * The first few are how the run started; the most recent are where it is now — the two
 * stretches a person actually reads without clicking. Everything between folds behind the
 * same disclosure a run of identical tool calls already uses, or a 30-turn node would put
 * thirty full reasoning blocks on screen at once.
 */
const THINKING_VISIBLE_EDGE = 2;

/**
 * How many of a node's grouped runs sit before folding starts being worth it.
 *
 * `groupSteps` already folds a run of many calls to *one* tool into a single row; this is
 * the same idea one level up, for the node that made calls to many different tools and so
 * never built a run long enough for that to fire. A worker whose thirty steps were "read,
 * grep, read, edit, grep, …" produced thirty single-step rows, and the panel became the
 * same wall of near-identical lines `groupSteps`'s own doc comment describes — just with a
 * different tool name each time. Below this count the list is short enough to read as it
 * stands, and wrapping it in a disclosure would spend a click for nothing.
 */
const STEPS_FOLD_THRESHOLD = 8;

/**
 * How many of the most recent runs stay unfolded regardless — the tail a person actually
 * came to read, the same way `THINKING_VISIBLE_EDGE` keeps a reasoning stream's own recent
 * edge in view. A reply run is never folded even when it falls earlier than this, whatever
 * its position: `groupSteps`'s `standsAlone` already protects every reply from being
 * merged into a tool-call run for exactly this reason, and a list-level fold that hid one
 * behind "12 earlier steps" would undo that protection one layer up.
 */
const STEPS_VISIBLE_TAIL = 6;

/**
 * One turn's reply, archived into the permanent record.
 *
 * Drawn with the same `.reply` markup — `Prose` plus the `Copy` button — the live summary
 * already gets, not a tool call's tick-and-title row: a reply never ran anything, and a
 * reader scanning the panel for what the agent actually said should find every one of them
 * looking like the answer it is, not like a step in a list of tool calls.
 */
function ReplyRow({ state, step, opener }: { state: State; step: Step; opener: Opener }) {
	const text = step.preview ?? "";
	return (
		<div className="reply">
			<Copy text={text} />
			<Prose text={text} base={state.settings?.material ?? undefined} opener={opener} />
		</div>
	);
}

/**
 * The text of a node's last archived reply step, or `undefined` if it has none.
 *
 * Used to decide whether the top-of-panel `.reply` block would repeat what the archived
 * stream already shows. The two agree exactly whenever this node went through the normal
 * turn loop: `record.ts`'s `message_end` handler writes `summary` and the last reply step
 * from the same `replyText`, in the same call. They can disagree in two cases, and both are
 * real answers this panel still has to show: a node whose window was replaced by compaction,
 * where `closeNode` overwrites `summary` with a synthesised digest that was never any turn's
 * own reply and so never became a step; and a node recorded before this archiving existed,
 * which has a `summary` and no steps at all. Comparing text rather than just checking
 * "any reply steps exist" is what catches the compaction case — that node can easily have
 * reply steps from its earlier turns, just not one that matches what `summary` says now.
 */
function lastReplyText(node: TraceNode): string | undefined {
	for (let i = node.steps.length - 1; i >= 0; i -= 1) {
		const step = node.steps[i];
		if (step.kind === "reply") return step.preview;
	}
	return undefined;
}

function expandedThinkingIds(steps: Step[]): Set<string> {
	const thinking = steps.filter((step) => step.kind === "thinking");
	const edge = THINKING_VISIBLE_EDGE;
	const visible = [
		...thinking.slice(0, edge),
		...thinking.slice(Math.max(edge, thinking.length - edge)),
	];
	return new Set(visible.map((step) => step.id));
}

/** A node's tool calls, grouped and folded — the same rendering the current node used alone
 *  before a compacted point could bring its whole chain into one panel. */
function StepsList({
	state,
	node,
	onFetchFull,
	opener,
}: {
	state: State;
	node: TraceNode;
	onFetchFull: FetchFull;
	opener: Opener;
}) {
	if (node.steps.length === 0) return null;
	const expandedThinking = expandedThinkingIds(node.steps);

	// Grouped rather than listed. A worker researching one topic made twenty-odd
	// consecutive greps and reads, and twenty near-identical rows with previews under
	// them buried the shape of what it did. A run of one is unchanged; a run of several
	// folds into a count you can open. What never folds is what a person is looking for —
	// the call that opened children, and the call that failed or was stopped.
	const runs = groupSteps(node.steps);

	function renderRun(run: StepRun) {
		// A thinking step always stands alone (see `standsAlone`), so a run carrying one
		// is never a folded group of it — it is drawn as reasoning, not as a call.
		if (run.steps[0].kind === "thinking") {
			const step = run.steps[0];
			return <ThinkingRow key={step.id} step={step} expanded={expandedThinking.has(step.id)} />;
		}
		// A reply always stands alone too (see `standsAlone` in `steps.ts`), so a run
		// carrying one is never a folded group of it — it is drawn as the answer it is,
		// not as a call.
		if (run.steps[0].kind === "reply") {
			const step = run.steps[0];
			return <ReplyRow key={step.id} state={state} step={step} opener={opener} />;
		}
		// What the person said, drawn where they said it. Same `.you` styling it had when it
		// was a block above the log, so nothing about how it reads changes — only where.
		if (run.steps[0].kind === "you") {
			const step = run.steps[0];
			return (
				<div className="you" key={step.id}>
					{step.preview}
				</div>
			);
		}
		return run.steps.length <= 2 ? (
			run.steps.map((step) => (
				<StepRow key={step.id} state={state} nodeId={node.id} step={step} onFetchFull={onFetchFull} />
			))
		) : (
			<details className="step run" key={run.steps[0].id}>
				<summary>{run.title}</summary>
				{run.steps.map((step) => (
					<StepRow key={step.id} state={state} nodeId={node.id} step={step} onFetchFull={onFetchFull} />
				))}
			</details>
		);
	}

	// The same fold one level up, for the runs `groupSteps` could not merge into each
	// other because they called different tools — see `STEPS_FOLD_THRESHOLD`'s own doc
	// comment. Everything within `STEPS_VISIBLE_TAIL` of the end stays as it was; a reply
	// run keeps its own row wherever it falls, never swept into the fold; every other run
	// ahead of the tail collects into one disclosure per unbroken stretch, so the count on
	// its summary line still describes one continuous span of work rather than a shuffled
	// pile of it.
	const tailStart = Math.max(0, runs.length - STEPS_VISIBLE_TAIL);
	const foldableEarly = runs
		.slice(0, tailStart)
		.filter((run) => run.steps[0].kind !== "reply").length;

	if (foldableEarly < STEPS_FOLD_THRESHOLD) {
		return <div className="steps">{runs.map(renderRun)}</div>;
	}

	const rows: ReactNode[] = [];
	let pending: StepRun[] = [];
	const flushPending = () => {
		if (pending.length === 0) return;
		const stepCount = pending.reduce((sum, run) => sum + run.steps.length, 0);
		rows.push(
			<details className="step run stepsFold" key={`fold-${pending[0].steps[0].id}`}>
				<summary>{stepCount} earlier steps</summary>
				{pending.map(renderRun)}
			</details>,
		);
		pending = [];
	};
	runs.forEach((run, index) => {
		if (index < tailStart && run.steps[0].kind !== "reply") {
			pending.push(run);
			return;
		}
		flushPending();
		rows.push(renderRun(run));
	});
	flushPending();

	return <div className="steps">{rows}</div>;
}

/**
 * One earlier link in the stitched chain: what was said to it, what it answered, what it
 * did. Always closed by the time it appears here — the live, still-working entry is the
 * current node, drawn separately below with its own streaming and thinking.
 */
function ChainEntry({
	state,
	node,
	onFetchFull,
	opener,
}: {
	state: State;
	node: TraceNode;
	onFetchFull: FetchFull;
	opener: Opener;
}) {
	// Same fallback as the main render: drawn here only for a window whose own steps do not
	// already carry what was said to it.
	const said = node.steps.some((step) => step.kind === "you") ? [] : (state.saidBy[node.id] ?? []);
	// Shown only when it says something the archived reply steps below do not already say —
	// see `lastReplyText`'s own doc comment for the two cases where that happens. For the
	// ordinary case this block simply does not render: the same text is already the last
	// `.reply` row `StepsList` draws, in its true place in the turn order rather than
	// separated out above the steps that produced it.
	const summaryIsArchived = node.summary !== undefined && node.summary === lastReplyText(node);
	return (
		<div className="chainEntry">
			{said.map((text, index) => (
				<div className="you" key={index}>
					{text}
				</div>
			))}
			<StepsList state={state} node={node} onFetchFull={onFetchFull} opener={opener} />
			{node.summary && !summaryIsArchived && (
				<div className="reply">
					<Copy text={node.summary} />
					<Prose text={node.summary} base={state.settings?.material ?? undefined} opener={opener} />
				</div>
			)}
			{node.error && <div className="failure">{node.error}</div>}
		</div>
	);
}

function origin(node: TraceNode, state: State): string {
	switch (node.origin.kind) {
		case "root":
			return "the start of the conversation";
		case "delegate":
			return `delegated by ${state.nodes[node.parentId ?? ""]?.agent ?? "someone"} — the answer went back to it`;
		case "branch":
			return node.origin.by === "you"
				? "a line you started from here — nothing waits for it"
				: "a line the model started — nothing waits for it";
		case "compact":
			return node.origin.reason === "manual"
				? "you ended the previous window; this one starts from its summary"
				: `the previous window filled up (${node.origin.reason}); this one starts from its summary`;
		case "handoff":
			return `${node.origin.from} handed the conversation over; this one starts from a summary`;
	}
}

export function Detail({
	state,
	send,
	onFetchFull,
	onRevealFiles,
}: {
	state: State;
	send: (frame: ClientFrame) => void;
	onFetchFull: FetchFull;
	/** Bring the file browser column into view — see `Prose.tsx`'s `Opener`. */
	onRevealFiles: () => void;
}) {
	const node = state.selected ? state.nodes[state.selected] : undefined;
	// Built fresh each render rather than memoized: `state` itself is a new object on every
	// change the run makes, so memoizing on it would never actually hit, and `Prose.tsx`'s
	// own effect is already written to key off this object's stable pieces rather than its
	// identity — see the comment on `Ref`'s effect in `Prose.tsx` for why that split matters.
	const opener: Opener = { state, send, onRevealFiles };
	// Before the early return: a hook cannot be skipped, and there is no point to time yet.
	const worked = useWorked(node?.worked ?? 0, node?.busySince ?? undefined);
	const streaming = node ? state.live[node.id] : undefined;
	const reasoning = node ? state.thinking[node.id] : undefined;

	const container = useRef<HTMLElement | null>(null);
	/** The one element that holds everything scrolled — see the `ResizeObserver` below. */
	const body = useRef<HTMLDivElement | null>(null);
	/**
	 * Whether the panel should chase new content to the bottom.
	 *
	 * A ref, not state: this changes on every scroll event and on every resize of the
	 * content below it, and a token arriving every few milliseconds is not a reason to
	 * re-render the whole panel. It only has to be read at the moment new content lands.
	 */
	const follow = useRef(true);
	/**
	 * Mirrors `follow.current`, but as state — the one place this fact has to cause a
	 * re-render, so the "jump to latest" control can appear the instant a person scrolls
	 * away and disappear the instant they come back or click it.
	 */
	const [detached, setDetached] = useState(false);

	// A point just selected starts pinned to its own tail, not wherever a different point
	// happened to leave the scrollbar — then a `ResizeObserver` on the content itself keeps
	// it pinned for as long as `follow` holds, however the content below it grows.
	//
	// Not a dependency list of "everything that might change the height"
	// (`streaming`/`reasoning`/`node.summary`/`stepCount`) — that was tried, by the previous
	// version of this effect, and it was always one case short. A run of tool calls folding
	// into a `<details>`, or KaTeX finishing an async layout pass, changes the height of
	// content above the newest row without changing any of those four values — exactly the
	// "scrollHeight oscillating between renders while scrollTop sits wherever it last was"
	// failure both reviewers measured. Watching the box's own size, whatever moved it, is
	// the only version of this that cannot fall behind it.
	useLayoutEffect(() => {
		follow.current = true;
		setDetached(false);
		const scrollEl = container.current;
		const contentEl = body.current;
		if (!scrollEl || !contentEl) return;
		// `useLayoutEffect` rather than `useEffect`, and an immediate jump before the
		// observer is even wired up: both run before the browser paints, so a point just
		// selected lands on its own tail in the same frame it appears rather than as a
		// visible snap after.
		scrollEl.scrollTop = scrollEl.scrollHeight;
		const observer = new ResizeObserver(() => {
			if (!follow.current) return;
			scrollEl.scrollTop = scrollEl.scrollHeight;
		});
		observer.observe(contentEl);
		return () => observer.disconnect();
	}, [node?.id]);

	if (!node) {
		return (
			<aside className="detail" ref={container}>
				<p className="hint">Click a point to read it.</p>
			</aside>
		);
	}

	const live = isLive(node);
	const spend = rollup(state, node.id);
	// Only what the step stream does not already carry. A sentence typed at this build is
	// recorded as a `"you"` step and renders in its place in the log; one typed before that
	// existed — or read back from a conversation saved by an older build — has no step, and
	// this block is the only thing that would draw it at all. Falling back to the block for
	// exactly those keeps old conversations readable without drawing today's twice.
	const said = node.steps.some((step) => step.kind === "you") ? [] : (state.saidBy[node.id] ?? []);
	// The earlier windows this one continues from, oldest first — see `chatChain`'s own
	// doc comment for why only `compact` origins are walked. `chain[0]` is where the
	// conversation actually started; everything from there to `node` reads as one exchange.
	const chain = chatChain(state, node.id);
	const oldest = chain[0] ?? node;

	return (
		<aside
			className="detail"
			ref={container}
			onScroll={(event) => {
				const el = event.currentTarget;
				// Near enough counts as "at the bottom": scrollHeight/scrollTop arithmetic
				// rarely lands on an exact integer, and a one-pixel gap should not read as
				// "the person scrolled away".
				const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
				follow.current = atBottom;
				setDetached(!atBottom);
			}}
		>
			{/* The one wrapper the `ResizeObserver` above watches. Everything that scrolls
			    lives inside it, so its height is exactly the panel's `scrollHeight` — the
			    figure the observer needs, and the one a flex-sized `.detail` cannot report
			    about itself, since `.detail`'s own box stays the viewport's size while this
			    div is what actually grows. */}
			<div className="detailBody" ref={body}>
				<div className="detailHead">
					<span className={`mark ${node.state}`}>{node.busy ? "◍" : MARK[node.state]}</span>
					<strong>{node.agent}</strong>
					<span className="meta id">{node.id}</span>
					{!live && <span className={`meta closedTag ${node.state}`}>{ENDED[node.state]}</span>}
					{node.busy && <span className="meta working">working</span>}
				</div>

				<p className="why">{origin(node, state)}</p>

				<div className="figures">
					<span title="how many delegations deep this point is">depth {node.depth}</span>
					<span title="this window alone">{money(node.usage.cost.total)} own</span>
					{hasDelegated(state, node.id) && (
						<span title="this window plus the work it delegated; lines started here are not included">
							{money(spend.cost.total)} with delegated
						</span>
					)}
					<span>{node.usage.totalTokens.toLocaleString()} tok</span>
					<span title="how long this window has spent working, added up over its turns">{formatDuration(worked)}</span>
					{/* Which model wrote this. It was recorded from the first day and shown nowhere,
					    which was survivable while a run had one model in it. The model is now a
					    per-conversation setting, so a graph can hold windows written by two of them,
					    and the difference in what they produce is visible to the naked eye. */}
					{node.model && <span title="the model that wrote this window">{node.model}</span>}
				</div>

				{oldest.task && (
					<details className="task">
						<summary>given: {oldest.task.replace(/\s+/g, " ").trim().slice(0, 60)}…</summary>
						<pre>{oldest.task}</pre>
					</details>
				)}

				{/* The earlier windows in this chain, stitched in as plain continuation rather
				    than left behind on a point that scrolled out of view. Each one is a closed
				    node, so it renders its own said/reply/steps in full; only the boundary
				    between them is marked, and barely — the same faintness `.wire.compact`
				    draws on the canvas, because compaction itself carries no news. */}
				{chain.slice(0, -1).map((ancestor) => (
					<Fragment key={ancestor.id}>
						<ChainEntry state={state} node={ancestor} onFetchFull={onFetchFull} opener={opener} />
						<div className="chainBreak" />
					</Fragment>
				))}

				{said.map((text, index) => (
					<div className="you" key={index}>
						{text}
					</div>
				))}

				{/* The work, then the word. `StepsList` is every call this window has already
				    finished, in the order it made them — the questions asked while it was still
				    in flight. The live block below is what it is doing right now, and the reply
				    is the answer those calls were for; putting both after the log instead of
				    above it is the whole fix: the newest thing to read is always the last thing
				    in the DOM, so "pin to bottom" is also "show me the point". */}
				<StepsList state={state} node={node} onFetchFull={onFetchFull} opener={opener} />

				{/* While it is working, never show the last answer: in the gap before the first
				    token it sat under the new question and read as the reply to it. */}
				{node.busy ? (
					<>
						{/* The reasoning is the work being watched, not the answer. It streams
						    ahead of the reply and is drawn as raw thought — dim, in its own block —
						    so a person can follow it instead of staring at a spinner. */}
						{reasoning && (
							<div className="thinking">
								<span className="thinkingLabel">thinking</span>
								<div className="thinkingText">{reasoning}</div>
							</div>
						)}
						<div className="reply streaming">
							{/* Drawn as it arrives, half-written markers and all. The parser writes an
							    unterminated `**` out as literal text rather than swallowing the rest, so a
							    sentence in progress reads as a sentence in progress and settles the moment
							    the agent closes the marker. */}
							{streaming ? (
								<Prose text={streaming} base={state.settings?.material ?? undefined} opener={opener} />
							) : reasoning ? null : (
								<span className="hint">thinking</span>
							)}
						</div>
					</>
				) : node.summary && node.summary !== lastReplyText(node) ? (
					// The fallback case, not the common one — see `lastReplyText`'s doc comment.
					// A node that answered through the ordinary turn loop has its last reply
					// already drawn above, as a step, in its true place after the tool calls
					// that led to it; rendering it again here would print the same paragraph
					// twice. This block exists for the node whose `summary` is not any turn's
					// reply at all, such as one closed by compaction.
					<div className="reply">
						<Copy text={node.summary} />
						<Prose text={node.summary} base={state.settings?.material ?? undefined} opener={opener} />
					</div>
				) : null}

				{node.error && <div className="failure">{node.error}</div>}
			</div>

			{/* One click back to the tail, for the person `onScroll` just detached — the
			    reply is not gone, it is only out of the window while they read something
			    earlier, and finding it again should not mean hunting for a scrollbar. */}
			{detached && (
				<button
					type="button"
					className="jumpToLatest"
					onClick={() => {
						const el = container.current;
						if (!el) return;
						follow.current = true;
						setDetached(false);
						el.scrollTop = el.scrollHeight;
					}}
				>
					↓ jump to latest
				</button>
			)}
		</aside>
	);
}
