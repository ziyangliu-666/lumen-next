/**
 * The call graph, as rows instead of a canvas.
 *
 * `Canvas.tsx` draws the same thing with pan, zoom and curved wires, and it is genuinely
 * better at one job: seeing the *shape* of a wide fan-out at a glance. It is worse at every
 * other job in a 320px column — a canvas that narrow shows two node boxes and asks you to
 * drag for the rest, and the thing a person usually wants from this panel is not the shape,
 * it is "which agent is working right now, what has it cost, how long has it been going".
 * Those are facts about rows.
 *
 * So the tree is what the column holds, and the canvas stays one file away, unchanged, for
 * whoever wants to look at the shape.
 *
 * The nesting is the call tree exactly as `state.children` already records it — no second
 * layout to keep in step with the one `Canvas.tsx` reads. What the four edge kinds mean is
 * in the README; here each row says its own kind in a word rather than in the shape of a
 * line, which is the one thing rows can do that curves cannot.
 */

import type { TraceNode } from "@lumen/kernel";
import { money } from "@lumen/kernel/trace/types";
import { formatDuration, useWorked } from "./elapsed.ts";
import type { State } from "./state.ts";

/**
 * How this window came to exist, in one short word for a row.
 *
 * The canvas says this with the shape of a line — solid, dashed, arrowheaded. A row has no
 * shape to spend, so it says the word instead. `delegate` is left unlabelled: it is what
 * most rows are, and a label repeated on every line stops being information.
 */
const ORIGIN: Record<string, string> = {
	root: "",
	delegate: "",
	branch: "branch",
	compact: "continued",
	handoff: "handed over",
};

export function CallTree({ state, onSelect }: { state: State; onSelect: (id: string) => void }) {
	if (!state.rootId || !state.nodes[state.rootId]) {
		return <div className="ideaEmpty">Nothing has opened yet.</div>;
	}
	return (
		<div className="ideaGraph">
			<ul className="ideaList">
				<CallItem id={state.rootId} state={state} onSelect={onSelect} />
			</ul>
		</div>
	);
}

function CallItem({
	id,
	state,
	onSelect,
}: {
	id: string;
	state: State;
	onSelect: (id: string) => void;
}) {
	const node = state.nodes[id];
	if (!node) return null;
	const children = state.children[id] ?? [];

	return (
		<li className="ideaNode">
			<CallRow node={node} state={state} onSelect={onSelect} />
			{children.length > 0 && (
				<ul className="ideaList">
					{children.map((childId) => (
						<CallItem key={childId} id={childId} state={state} onSelect={onSelect} />
					))}
				</ul>
			)}
		</li>
	);
}

function CallRow({
	node,
	state,
	onSelect,
}: {
	node: TraceNode;
	state: State;
	onSelect: (id: string) => void;
}) {
	// The same ticking figure the canvas box shows, from the same hook, so a row and a box
	// never disagree about how long something has been going.
	const worked = useWorked(node.worked ?? 0, node.busySince ?? undefined);
	const selected = state.selected === node.id;
	const busy = node.busy === true;
	const origin = ORIGIN[node.origin.kind] ?? "";
	// Thinking and replies are archived as steps too (see `StepKind`), so counting every step
	// would call a window that answered twice a window that used two tools.
	const tools = node.steps.filter((step) => (step.kind ?? "tool") === "tool").length;

	// State is the row's own colour, not a glyph in front of it. A mark small enough to sit
	// before a name is small enough to miss, and a column of them is noise on every row that
	// has nothing to report; the whole row tinting is unmissable and costs no width, which
	// also lets the agent's name start at the very left edge where it is easiest to scan.
	const tone = busy ? "busy" : node.state === "failed" || node.state === "aborted" ? node.state : "";

	return (
		<div className={`idea call${tone ? ` ${tone}` : ""}${selected ? " selected" : ""}`}>
			<div className="ideaRow">
				<button
					type="button"
					className="ideaToggle"
					onClick={() => onSelect(node.id)}
					title="read this window"
				>
					<span className="ideaTitle">{node.agent}</span>
					<span className="callMeta">
						{origin && <span className="callOrigin">{origin}</span>}
						<span>{money(node.usage.cost.total)}</span>
						{tools > 0 && <span>{tools}t</span>}
						<span>{formatDuration(worked)}</span>
					</span>
				</button>
			</div>
		</div>
	);
}
