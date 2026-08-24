/**
 * One point, in full.
 *
 * The canvas answers "what is the shape of this run"; this answers "what happened in this
 * window". Splitting them is what let the canvas become a canvas: everything that has to
 * be read word by word lives here, so a point on the graph can stay the size of a point.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { Step, TraceNode } from "@lumen/kernel";
import { money } from "@lumen/kernel/trace/types";
import { formatDuration, useWorked } from "./elapsed.ts";
import { Prose } from "./Prose.tsx";
import { groupSteps } from "./steps.ts";
import { hasDelegated, isLive, rollup, type State } from "./state.ts";

const MARK: Record<string, string> = { done: "✓", failed: "✗", aborted: "■", running: "•" };

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

function StepRow({ state, step }: { state: State; step: Step }) {
	return (
		<div className="step">
			<div className={`stepHead ${step.state}`}>
				<span className="mark" title={step.state}>
					{MARK[step.state]}
				</span>
				<span className="title">{step.title}</span>
			</div>
			{step.preview && !step.childIds?.length && <div className="preview">{step.preview}</div>}
			{step.childIds?.map((childId) => (
				<div className="spawned" key={childId}>
					{state.nodes[childId]?.agent} ({childId}) — on the canvas
				</div>
			))}
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

export function Detail({ state }: { state: State }) {
	const node = state.selected ? state.nodes[state.selected] : undefined;
	// Before the early return: a hook cannot be skipped, and there is no point to time yet.
	const worked = useWorked(node?.worked ?? 0, node?.busySince ?? undefined);
	const streaming = node ? state.live[node.id] : undefined;
	const reasoning = node ? state.thinking[node.id] : undefined;
	const stepCount = node?.steps.length ?? 0;

	const container = useRef<HTMLElement | null>(null);
	/**
	 * Whether the panel should chase new content to the bottom.
	 *
	 * A ref, not state: this changes on every scroll event, and a token arriving every few
	 * milliseconds is not a reason to re-render the whole panel. It only has to be read at
	 * the moment new content lands.
	 */
	const follow = useRef(true);

	// A point just selected starts pinned to its own tail, not wherever a different point
	// happened to leave the scrollbar.
	useLayoutEffect(() => {
		follow.current = true;
	}, [node?.id]);

	// Chase the tail while it streams, the way a terminal does — but only while `follow`
	// holds. A person who scrolled up to read something earlier must not be dragged back
	// down by the next token; that was the actual bug, not the absence of scrolling.
	// `useLayoutEffect` rather than `useEffect`: it runs before the browser paints, so the
	// jump happens in the same frame as the new content rather than as a visible snap after.
	useLayoutEffect(() => {
		const el = container.current;
		if (!el || !follow.current) return;
		el.scrollTop = el.scrollHeight;
	}, [node?.id, streaming, reasoning, node?.summary, stepCount]);

	if (!node) {
		return (
			<aside className="detail" ref={container}>
				<p className="hint">Click a point to read it.</p>
			</aside>
		);
	}

	const live = isLive(node);
	const spend = rollup(state, node.id);
	const said = state.saidBy[node.id] ?? [];

	return (
		<aside
			className="detail"
			ref={container}
			onScroll={(event) => {
				const el = event.currentTarget;
				// Near enough counts as "at the bottom": scrollHeight/scrollTop arithmetic
				// rarely lands on an exact integer, and a one-pixel gap should not read as
				// "the person scrolled away".
				follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
			}}
		>
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

			{node.task && (
				<details className="task">
					<summary>given: {node.task.replace(/\s+/g, " ").trim().slice(0, 60)}…</summary>
					<pre>{node.task}</pre>
				</details>
			)}

			{said.map((text, index) => (
				<div className="you" key={index}>
					{text}
				</div>
			))}

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
							<Prose text={streaming} base={state.settings?.material ?? undefined} />
						) : reasoning ? null : (
							<span className="hint">thinking</span>
						)}
					</div>
				</>
			) : node.summary ? (
				<div className="reply">
					<Copy text={node.summary} />
					<Prose text={node.summary} base={state.settings?.material ?? undefined} />
				</div>
			) : null}

			{node.error && <div className="failure">{node.error}</div>}

			{node.steps.length > 0 && (
				<div className="steps">
					{/* Grouped rather than listed. A worker researching one topic made twenty-odd
					    consecutive greps and reads, and twenty near-identical rows with previews
					    under them buried the shape of what it did. A run of one is unchanged; a
					    run of several folds into a count you can open. What never folds is what a
					    person is looking for — the call that opened children, and the call that
					    failed or was stopped. */}
					{groupSteps(node.steps).map((run) =>
						// Folded from three. Two rows are not a wall: folding them costs a click,
						// saves one line, and puts a disclosure triangle over the amount of content
						// that reads as though something bigger were hidden behind it.
						run.steps.length <= 2 ? (
							run.steps.map((step) => <StepRow key={step.id} state={state} step={step} />)
						) : (
							<details className="step run" key={run.steps[0].id}>
								<summary>{run.title}</summary>
								{run.steps.map((step) => (
									<StepRow key={step.id} state={state} step={step} />
								))}
							</details>
						),
					)}
				</div>
			)}
		</aside>
	);
}
