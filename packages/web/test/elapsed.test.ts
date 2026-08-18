/**
 * The duration a point shows, pinned at every boundary.
 *
 * `useElapsed` is not tested here. It needs a React renderer and a DOM, and this repo has
 * neither in its test setup; adding one for a single hook would cost more than it pins down.
 * Everything with a decision in it — what the string says and how wide it stays — lives in
 * `formatDuration`, which is a pure function, and that is what is checked below.
 */

import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/elapsed.ts";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Every width the figure takes over a range, which must be one width for it not to jitter. */
function widths(from: number, to: number, step: number): number[] {
	const seen = new Set<number>();
	for (let ms = from; ms <= to; ms += step) seen.add(formatDuration(ms).length);
	return [...seen];
}

describe("formatDuration", () => {
	it("says milliseconds below a second, so short work does not read as no time at all", () => {
		expect(formatDuration(0)).toBe("0ms");
		expect(formatDuration(1)).toBe("1ms");
		expect(formatDuration(42)).toBe("42ms");
		expect(formatDuration(300)).toBe("300ms");
		expect(formatDuration(999)).toBe("999ms");
	});

	it("changes to seconds at one second, on both sides of the boundary", () => {
		expect(formatDuration(999)).toBe("999ms");
		expect(formatDuration(999.6)).toBe("1s");
		expect(formatDuration(SECOND)).toBe("1s");
	});

	it("changes to minutes at sixty seconds, on both sides of the boundary", () => {
		expect(formatDuration(MINUTE - 1)).toBe("59s");
		expect(formatDuration(MINUTE)).toBe("1m00s");
		expect(formatDuration(MINUTE + SECOND)).toBe("1m01s");
	});

	it("changes to hours at sixty minutes, on both sides of the boundary", () => {
		expect(formatDuration(HOUR - 1)).toBe("59m59s");
		expect(formatDuration(HOUR)).toBe("1h00m");
		expect(formatDuration(HOUR + MINUTE)).toBe("1h01m");
	});

	it("pads a field only when a larger field comes first", () => {
		// The leading field never carries a zero: `01m05s` costs a character and reads as a
		// stopwatch, and the eye does not need it to hold the width steady.
		expect(formatDuration(MINUTE + 5 * SECOND)).toBe("1m05s");
		expect(formatDuration(9 * MINUTE + 5 * SECOND)).toBe("9m05s");
		expect(formatDuration(HOUR + 5 * MINUTE)).toBe("1h05m");
		expect(formatDuration(9 * SECOND)).toBe("9s");
	});

	it("never claims a second that has not finished", () => {
		expect(formatDuration(1999)).toBe("1s");
		expect(formatDuration(59_999)).toBe("59s");
		expect(formatDuration(2 * MINUTE - 1)).toBe("1m59s");
		expect(formatDuration(2 * HOUR - 1)).toBe("1h59m");
	});

	it("drops the seconds once the run is an hour old", () => {
		// A person reading an hour-long run does not read its seconds digit, and carrying it
		// would repaint the point sixty times for every change they could see.
		expect(formatDuration(HOUR + 30 * SECOND)).toBe("1h00m");
		expect(formatDuration(HOUR + MINUTE + 59 * SECOND)).toBe("1h01m");
	});

	it("keeps counting past a day rather than wrapping", () => {
		expect(formatDuration(25 * HOUR + 3 * MINUTE)).toBe("25h03m");
	});

	it("holds one width while it ticks through the first ten seconds", () => {
		expect(widths(SECOND, 9 * SECOND, SECOND)).toEqual([2]);
	});

	it("holds one width while it ticks through the rest of the minute", () => {
		expect(widths(10 * SECOND, MINUTE - SECOND, SECOND)).toEqual([3]);
	});

	it("holds one width while it ticks through the first ten minutes", () => {
		// The case the zero-padding is for. Without it the string would shrink and grow every
		// second between `1m9s` and `1m10s`, and the whole row would twitch with it.
		expect(widths(MINUTE, 10 * MINUTE - SECOND, SECOND)).toEqual([5]);
	});

	it("holds one width while it ticks through the rest of the hour", () => {
		expect(widths(10 * MINUTE, HOUR - SECOND, SECOND)).toEqual([6]);
	});

	it("holds one width while it ticks through the first ten hours", () => {
		expect(widths(HOUR, 10 * HOUR - MINUTE, MINUTE)).toEqual([5]);
	});

	it("stays narrow enough for the point it sits in", () => {
		// The point is 178px wide and the cost figure is beside it, so six characters is the
		// budget. Checked over every scale rather than at the sample values above.
		for (let ms = 0; ms < 12 * HOUR; ms += 997) {
			expect(formatDuration(ms).length).toBeLessThanOrEqual(6);
		}
	});

	it("reads a clock that went backwards as no time at all", () => {
		// The server stamps `startedAt` and the browser subtracts it. A browser a few seconds
		// behind makes a point that just opened look like it opens in the future.
		expect(formatDuration(-1)).toBe("0ms");
		expect(formatDuration(-MINUTE)).toBe("0ms");
		expect(formatDuration(-0)).toBe("0ms");
	});

	it("prints no figure when there is no number to print", () => {
		// Beside a real cost figure, an invented duration is read as a measured one.
		expect(formatDuration(Number.NaN)).toBe("--");
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("--");
		expect(formatDuration(Number.NEGATIVE_INFINITY)).toBe("--");
	});
});
