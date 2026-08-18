/**
 * The fit calculation, checked without a browser.
 *
 * A view is three numbers, so every property a person cares about — the whole graph is on
 * screen, it is centred, it is not magnified — is arithmetic that can be pinned here rather
 * than found by dragging the canvas around.
 */

import { describe, expect, it } from "vitest";
import { fit, MARGIN, MAX_SCALE, MIN_SCALE, type View } from "../src/fit.ts";
import { COL, LANE, NODE_H, NODE_W, type Placed } from "../src/layout.ts";

function at(x: number, y: number): Placed {
	return { id: `${x}-${y}`, x, y };
}

/** A cols by rows block of points, spaced the way `layout` spaces them. */
function grid(cols: number, rows: number): Placed[] {
	const out: Placed[] = [];
	for (let c = 0; c < cols; c += 1) {
		for (let r = 0; r < rows; r += 1) out.push(at(c * COL, r * LANE));
	}
	return out;
}

/** Where the graph's outer box lands on screen, once the view transform is applied. */
function onScreen(placed: Placed[], view: View) {
	const xs = placed.map((p) => p.x);
	const ys = placed.map((p) => p.y);
	return {
		left: view.x + Math.min(...xs) * view.k,
		top: view.y + Math.min(...ys) * view.k,
		right: view.x + (Math.max(...xs) + NODE_W) * view.k,
		bottom: view.y + (Math.max(...ys) + NODE_H) * view.k,
	};
}

describe("fit", () => {
	it("centres a single point at its natural size", () => {
		const placed = [at(0, 0)];
		const view = fit(placed, { width: 1200, height: 800 });
		const box = onScreen(placed, view);

		expect(view.k).toBe(1);
		expect(box.left).toBeCloseTo(1200 - box.right);
		expect(box.top).toBeCloseTo(800 - box.bottom);
	});

	it("leaves a graph that already fits at scale 1", () => {
		// Three points in a 1200x800 window have room to be blown up to 200%. Doing that is
		// magnifying, not fitting, and it makes a two-agent run shout at the reader.
		const placed = [at(0, 0), at(COL, 0), at(COL, LANE)];
		const view = fit(placed, { width: 1200, height: 800 });

		expect(view.k).toBe(1);
	});

	it("shrinks a wide graph until its width fits, and keeps it on screen", () => {
		const placed = grid(12, 1);
		const view = fit(placed, { width: 1200, height: 800 });
		const box = onScreen(placed, view);
		const graphW = 11 * COL + NODE_W;

		expect(view.k).toBeCloseTo((1200 - MARGIN * 2) / graphW);
		expect(box.left).toBeGreaterThanOrEqual(MARGIN - 0.001);
		expect(box.right).toBeLessThanOrEqual(1200 - MARGIN + 0.001);
		expect(box.top).toBeCloseTo(800 - box.bottom);
	});

	it("shrinks a tall graph until its height fits, and keeps it on screen", () => {
		const placed = grid(1, 20);
		const view = fit(placed, { width: 1200, height: 800 });
		const box = onScreen(placed, view);
		const graphH = 19 * LANE + NODE_H;

		expect(view.k).toBeCloseTo((800 - MARGIN * 2) / graphH);
		expect(box.top).toBeGreaterThanOrEqual(MARGIN - 0.001);
		expect(box.bottom).toBeLessThanOrEqual(800 - MARGIN + 0.001);
		expect(box.left).toBeCloseTo(1200 - box.right);
	});

	it("measures the boxes, not the corners", () => {
		// The failure this function exists to fix. Two columns of corners span 238px and fit a
		// 396px window at 100%, but the right-hand point is 178px wide, so fitting the corners
		// hangs it off the edge of the screen. Every point must be inside the window.
		const placed = [at(0, 0), at(COL, 0)];
		const view = fit(placed, { width: MARGIN * 2 + 300, height: 800 });
		const box = onScreen(placed, view);

		expect(view.k).toBeLessThan(1);
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(MARGIN * 2 + 300);
	});

	it("stops at the minimum scale and shows the root when a graph is too big", () => {
		const placed = grid(20, 40);
		const view = fit(placed, { width: 1200, height: 800 });
		const box = onScreen(placed, view);

		expect(view.k).toBe(MIN_SCALE);
		expect(box.left).toBeCloseTo(MARGIN);
		expect(box.top).toBeCloseTo(MARGIN);
	});

	it("centres the axis that fits even when the other one is clamped", () => {
		// A wide flat fan hits the minimum scale on width alone. Anchoring both axes would
		// jam a two-row graph against the top of a window with 700px to spare.
		const placed = grid(40, 2);
		const view = fit(placed, { width: 1200, height: 800 });
		const box = onScreen(placed, view);

		expect(view.k).toBe(MIN_SCALE);
		expect(box.left).toBeCloseTo(MARGIN);
		expect(box.top).toBeCloseTo(800 - box.bottom);
	});

	it("anchors the root, not the world origin", () => {
		// `layout` starts at 0,0 today. If it ever pads, an anchor written against the origin
		// would put the padding on screen and the root just off it.
		const placed = grid(20, 40).map((p) => at(p.x + 500, p.y + 300));
		const view = fit(placed, { width: 1200, height: 800 });
		const box = onScreen(placed, view);

		expect(box.left).toBeCloseTo(MARGIN);
		expect(box.top).toBeCloseTo(MARGIN);
	});

	it("never zooms outside the range the wheel handler allows", () => {
		for (const placed of [[at(0, 0)], grid(3, 3), grid(12, 1), grid(1, 20), grid(20, 40)]) {
			const view = fit(placed, { width: 1200, height: 800 });
			expect(view.k).toBeGreaterThanOrEqual(MIN_SCALE);
			expect(view.k).toBeLessThanOrEqual(MAX_SCALE);
		}
	});

	it("gives the neutral view for an empty graph", () => {
		// An empty list has no extent, and the scale that fits it is 0/0. NaN reaches the DOM
		// as a transform that draws nothing, so the run's first point would never appear.
		expect(fit([], { width: 1200, height: 800 })).toEqual({ x: MARGIN, y: MARGIN, k: 1 });
	});

	it("gives the neutral view for a viewport with no room in it", () => {
		// A panel that React has not laid out yet reports 0x0. Fitting to it produces an
		// infinite scale, and the canvas never recovers because the numbers are already lost.
		for (const viewport of [{ width: 0, height: 0 }, { width: 1200, height: 0 }, { width: 0, height: 800 }]) {
			expect(fit([at(0, 0)], viewport)).toEqual({ x: MARGIN, y: MARGIN, k: 1 });
		}
		// A window smaller than the margins it asks for is the same case.
		expect(fit([at(0, 0)], { width: MARGIN * 2, height: 800 })).toEqual({ x: MARGIN, y: MARGIN, k: 1 });
	});
});
