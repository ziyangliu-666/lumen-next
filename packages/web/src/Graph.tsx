/**
 * The graph.
 *
 * Two directions, because two things happen and they are not the same thing:
 *
 *   down    delegation. Work sent out from a tool call, which comes back as text.
 *   along   the line continuing. The window was replaced by its own summary.
 *
 * The connector for a continuation is read from `origin`, never guessed from shape. A tool
 * call that spawned exactly one child and a compaction both draw as one point leading to
 * one point, and they mean opposite things.
 */

import type { TraceNode } from "@lumen/kernel";
import { hasDelegated, isLive, rollup, successors, type State } from "./state.ts";

const MARK: Record<string, string> = {
	done: "✓",
	failed: "✗",
	aborted: "■",
	running: "•",
};

/** How a finished window ended, in the word a person would use for it. */
const ENDED: Record<string, string> = {
	done: "window closed",
	failed: "failed",
	aborted: "stopped",
	running: "",
};

/** What kind of continuation this is, in the words a person would use. */
function edgeOf(node: TraceNode): { className: string; label: string } | null {
	switch (node.origin.kind) {
		case "compact":
			return node.origin.reason === "manual"
				? { className: "edge chosen", label: "you started a new window" }
				: { className: "edge forced", label: `window full (${node.origin.reason})` };
		case "handoff":
			return { className: "edge chosen", label: `${node.origin.from} handed over` };
		default:
			return null;
	}
}

export function Graph({
	state,
	nodeId,
	onSelect,
}: {
	state: State;
	nodeId: string;
	onSelect: (id: string) => void;
}) {
	const node = state.nodes[nodeId];
	if (!node) return null;

	const spend = rollup(state, node.id);
	const live = isLive(node);
	const selected = state.selected === node.id;
	const said = state.saidBy[node.id] ?? [];
	const streaming = state.live[node.id];
	// Only delegated work is folded into the total, so only that earns the word.
	const hasChildren = hasDelegated(state, node.id);

	return (
		<div className="line">
			<div
				className={`node ${live ? "live" : "closed"} ${selected ? "selected" : ""}`}
				// A child node is rendered inside its parent's box, so without this every
				// click reaches the root as well and the root, handling it last, wins. The
				// failure was silent and expensive: a question aimed at one subagent went to
				// the lead, which paid to open fresh windows and answer it again.
				// Closed points select too. Refusing the click silently was the same silent
				// wrong action as the bubbling bug: the click looked accepted, the composer
				// stayed pointed somewhere else, and the next message went to an agent the
				// person had not chosen. Selection is now honest, and the composer says why
				// this one cannot be typed into and where the live point is.
				onClick={(event) => {
					event.stopPropagation();
					onSelect(node.id);
				}}
				onKeyDown={(event) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					event.preventDefault();
					event.stopPropagation();
					onSelect(node.id);
				}}
				role="button"
				tabIndex={0}
			>
				<div className="head">
					<span className={`mark ${node.state}`} title={node.busy ? "working" : node.state}>
						{node.busy ? "◍" : MARK[node.state]}
					</span>
					<span className="agent">{node.agent}</span>
					{/* The id is on screen because `@n-4` in the composer refers to it. A
					    citation you cannot match to a box is a citation you cannot aim. */}
					<span className="meta id">{node.id}</span>
					<span className="meta" title="how many delegations deep this point is">
						depth {node.depth}
					</span>
					{/* Labelled apart because they are different numbers. A parent shows what
					    its whole subtree cost; a leaf shows only its own. Rendering both as a
					    bare figure invites reading one as the other. */}
					<span className="meta" title={hasChildren ? "this window plus the work it delegated; lines started here are not included" : "this window alone"}>
						${spend.cost.total.toFixed(4)}
						{hasChildren ? " total" : ""}
					</span>
					<span className="meta">{spend.totalTokens.toLocaleString()} tok</span>
					{hasChildren && (
						<span className="meta" title="this window's own spend, without anything below it">
							${node.usage.cost.total.toFixed(4)} own
						</span>
					)}
					{/* The exact word, not one word for three fates. "closed" for all of them
					    made a run you cancelled look identical to a window replaced by its
					    own summary, and those are not the same event. */}
					{!live && <span className={`meta closedTag ${node.state}`}>{ENDED[node.state]}</span>}
					{selected && <span className="meta here">you are here</span>}
				</div>

				{node.task && (
					// A `<details>` rather than a fixed clip. What a point was handed is the
					// whole record of why it answered as it did, and for a merge it is the
					// quoted material itself — clipping that to three lines hid the entire
					// point of quoting. Collapsed by default because a compaction summary can
					// be two thousand characters and would bury the answer.
					<details className="task" onClick={(event) => event.stopPropagation()}>
						<summary>
							given: {node.task.replace(/\s+/g, " ").trim().slice(0, 90)}
							{node.task.length > 90 ? "…" : ""}
						</summary>
						<pre>{node.task}</pre>
					</details>
				)}

				{said.map((text, index) => (
					<div className="you" key={index}>
						{text}
					</div>
				))}

				{/* While it is working, never show the last answer. In the gap between your
				    question and the first streamed token, the old reply sat directly under
				    the new question and read as the response to it. */}
				{node.busy ? (
					<div className="reply streaming">{streaming || <span className="hint">thinking</span>}</div>
				) : node.summary ? (
					<div className="reply">{node.summary}</div>
				) : null}

				{node.error && <div className="failure">{node.error}</div>}

				{node.steps.map((step) => (
					<div className="step" key={step.id}>
						<div className={`stepHead ${step.state}`}>
							<span className="mark" title={step.state}>{MARK[step.state]}</span>
							<span className="title">{step.title}</span>
						</div>
						{step.preview && !step.childIds?.length && (
							<div className="preview">{step.preview}</div>
						)}
						{step.childIds?.map((childId) => {
							// A delegate belongs to this step: it answers and folds back in. A
							// branch was only started here and then went its own way. Drawing
							// them alike would claim the parent is waiting on work that will
							// never report back to it.
							const child = state.nodes[childId];
							const branch = child?.origin.kind === "branch" ? child.origin : null;
							return (
								<div className={branch ? "sent" : "delegated"} key={childId}>
									{branch && (
										<div className="sentLabel">
											▸ own line — {branch.by === "you" ? "you started it" : "nothing waits for it"}
										</div>
									)}
									<Graph state={state} nodeId={childId} onSelect={onSelect} />
								</div>
							);
						})}
					</div>
				))}
			</div>

			{successors(state, node.id).map((next) => {
				const edge = edgeOf(next);
				return (
					<div key={next.id}>
						{edge && <div className={edge.className}>{edge.label}</div>}
						<Graph state={state} nodeId={next.id} onSelect={onSelect} />
					</div>
				);
			})}
		</div>
	);
}
