/**
 * The view that puts a whole run on screen.
 *
 * The only control used to be "reset", which went back to 100% at the origin. That is not
 * a fit: a fan-out of 28 points across three columns is wider than the window at 100%, so
 * reset took a person who had lost the graph and showed them the same corner of it again.
 * The shape of the run is the product, and nobody could see it.
 *
 * So this computes the transform instead of guessing it. Canvas applies one
 * `translate(x, y) scale(k)` to the whole world, so a fit is three numbers and nothing else
 * has to change.
 */

import { NODE_H, NODE_W, type Placed } from "./layout.ts";

/**
 * The zoom limits, defined here so the wheel handler can import them.
 *
 * Two copies of `0.3` drift: someone widens the wheel range, fit keeps clamping to the old
 * one, and a large graph refuses to open as far as the same person can scroll it by hand.
 */
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 2;

/**
 * Space between the outermost point and the window edge, in screen pixels.
 *
 * 48 because the scale bar sits 10px from the bottom and is about 22px tall, so anything
 * under ~34 puts the bottom row of points behind it. The same number on all four sides
 * keeps a centred graph centred.
 */
export const MARGIN = 48;

export interface View {
	x: number;
	y: number;
	k: number;
}

export interface Viewport {
	width: number;
	height: number;
}

/**
 * The view that shows the whole graph.
 */
export function fit(placed: Placed[], viewport: Viewport): View {
	const width = Math.max(0, viewport.width);
	const height = Math.max(0, viewport.height);
	const usableW = width - MARGIN * 2;
	const usableH = height - MARGIN * 2;

	// Nothing to frame, or a panel that has not been laid out yet. Give back the neutral view
	// rather than a scale derived from a zero: dividing by an empty extent produces NaN, and
	// NaN reaches the DOM as a transform that silently draws nothing at all.
	if (placed.length === 0 || usableW <= 0 || usableH <= 0) return { x: MARGIN, y: MARGIN, k: 1 };

	// A Placed is a top-left corner, so the corners stop NODE_W short of the right-hand edge
	// and NODE_H short of the bottom. Fitting the corners clips the last column and the last
	// row, which is the exact failure this function exists to fix.
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const spot of placed) {
		minX = Math.min(minX, spot.x);
		minY = Math.min(minY, spot.y);
		maxX = Math.max(maxX, spot.x + NODE_W);
		maxY = Math.max(maxY, spot.y + NODE_H);
	}
	const graphW = maxX - minX;
	const graphH = maxY - minY;

	// Never past 1. A two-point run blown up to 200% is not fitted, it is magnified, and a
	// person reads a small graph at the size the rest of the interface uses.
	const room = Math.min(usableW / graphW, usableH / graphH);
	const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(1, room)));

	// Centre what is left over. When the graph is too big even at the minimum scale the spare
	// goes negative, and centring would push the root off the left edge; anchor that axis at
	// the margin instead, because the root is the leftmost topmost point and that is where a
	// person starts reading. The two axes decide separately: a wide short graph at the minimum
	// scale still centres vertically.
	const spareX = width - graphW * k;
	const spareY = height - graphH * k;
	return {
		x: (spareX >= 0 ? spareX / 2 : MARGIN) - minX * k,
		y: (spareY >= 0 ? spareY / 2 : MARGIN) - minY * k,
		k,
	};
}
