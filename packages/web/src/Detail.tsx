/**
 * One point, in full.
 *
 * The canvas answers "what is the shape of this run"; this answers "what happened in this
 * window". Splitting them is what let the canvas become a canvas: everything that has to
 * be read word by word lives here, so a point on the graph can stay the size of a point.
 */

import type { TraceNode } from "@lumen/kernel";
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
	if (!node) {
		return (
			<aside className="detail">
				<p className="hint">Click a point to read it.</p>
			</aside>
		);
	}

	const live = isLive(node);
	const spend = rollup(state, node.id);
	const said = state.saidBy[node.id] ?? [];
	const streaming = state.live[node.id];

	return (
		<aside className="detail">
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
				<span title="this window alone">${node.usage.cost.total.toFixed(4)} own</span>
				{hasDelegated(state, node.id) && (
					<span title="this window plus the work it delegated; lines started here are not included">
						${spend.cost.total.toFixed(4)} with delegated
					</span>
				)}
				<span>{node.usage.totalTokens.toLocaleString()} tok</span>
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
				<div className="reply streaming">{streaming || <span className="hint">thinking</span>}</div>
			) : node.summary ? (
				<div className="reply">{node.summary}</div>
			) : null}

			{node.error && <div className="failure">{node.error}</div>}

			{node.steps.length > 0 && (
				<div className="steps">
					{node.steps.map((step) => (
						<div className="step" key={step.id}>
							<div className={`stepHead ${step.state}`}>
								<span className="mark" title={step.state}>
									{MARK[step.state]}
								</span>
								<span className="title">{step.title}</span>
							</div>
							{step.preview && !step.childIds?.length && (
								<div className="preview">{step.preview}</div>
							)}
							{step.childIds?.map((childId) => (
								<div className="spawned" key={childId}>
									{state.nodes[childId]?.agent} ({childId}) — on the canvas
								</div>
							))}
						</div>
					))}
				</div>
			)}
		</aside>
	);
}
