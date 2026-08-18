/**
 * Where each point sits on the canvas.
 *
 * A tidy tree growing to the right: x is how far from the start of the conversation, y is
 * a row of its own for every point that has no children, with parents centred over what
 * they produced. So two agents working in parallel sit side by side and read as parallel,
 * and a fan-out looks like a fan.
 *
 * An earlier version put the two relationships on the two axes — a line running right, work
 * dropping down — and it collapsed on contact: two parallel delegates are the same distance
 * from the root, so they wanted the same x and different y, while a line continuing wanted
 * the same y and a different x. The two rules fought over one axis and everything stacked
 * into a single column.
 *
 * So direction carries distance, and the edge *style* carries the kind. That is not a
 * retreat: the four styles were already the thing people read the picture by.
 */

import type { State } from "./state.ts";

export const NODE_W = 178;
export const NODE_H = 56;
export const COL = 238;
export const LANE = 84;

export interface Placed {
	id: string;
	x: number;
	y: number;
}

export function layout(state: State): { placed: Placed[]; width: number; height: number } {
	const placed: Placed[] = [];
	if (!state.rootId || !state.nodes[state.rootId]) return { placed, width: 0, height: 0 };

	let nextRow = 0;
	// Post-order: children take their rows first, then the parent centres on them. A leaf
	// takes the next free row, which is what stops any two points overlapping.
	const place = (id: string, depth: number): number => {
		if (!state.nodes[id]) return 0;
		const children = (state.children[id] ?? []).filter((childId) => state.nodes[childId]);
		let row: number;
		if (children.length === 0) {
			row = nextRow;
			nextRow += 1;
		} else {
			const rows = children.map((childId) => place(childId, depth + 1));
			row = (Math.min(...rows) + Math.max(...rows)) / 2;
		}
		placed.push({ id, x: depth * COL, y: row * LANE });
		return row;
	};
	place(state.rootId, 0);

	const width = Math.max(...placed.map((p) => p.x)) + NODE_W;
	const height = Math.max(...placed.map((p) => p.y)) + NODE_H;
	return { placed, width, height };
}

export interface Edge {
	from: Placed;
	to: Placed;
	kind: "delegate" | "branch" | "compact" | "handoff";
	path: string;
}

export function edges(state: State, placed: Placed[]): Edge[] {
	const at = new Map(placed.map((p) => [p.id, p]));
	const out: Edge[] = [];
	for (const spot of placed) {
		const node = state.nodes[spot.id];
		if (!node?.parentId) continue;
		const from = at.get(node.parentId);
		if (!from || node.origin.kind === "root") continue;

		// Out of the parent's right edge, into the child's left edge, bowed so that several
		// children leaving the same point stay tellable apart.
		const x1 = from.x + NODE_W;
		const y1 = from.y + NODE_H / 2;
		const x2 = spot.x;
		const y2 = spot.y + NODE_H / 2;
		const bend = Math.max(28, (x2 - x1) / 2);
		out.push({
			from,
			to: spot,
			kind: node.origin.kind,
			path: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`,
		});
	}
	return out;
}
