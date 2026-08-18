/**
 * How long a window has been open, written for a person watching it run.
 *
 * A point already says what it cost. It said nothing about time, so a worker ninety seconds
 * into one web fetch and a worker that is stuck looked exactly alike: a spinner. A figure
 * that grows is the only thing on screen that tells the two apart.
 */

import { useEffect, useState } from "react";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Two digits, for a field that sits behind a larger one. */
function pad(value: number): string {
	return value < 10 ? `0${value}` : `${value}`;
}

/**
 * A duration a person reads at a glance, not a precise one.
 *
 * The string shares a 178px point with the cost figure, so it has to stay at six characters
 * or fewer. Two rules follow, and both are really one rule: the figure must not change width
 * while it ticks, or every row it sits in twitches once a second.
 *
 * 1. Resolution drops as the scale grows. Whole seconds below a minute, seconds inside a
 *    minute, minutes inside an hour. Nobody reads the seconds digit of an hour-long run, and
 *    carrying it would repaint the point sixty times for each change anyone can see.
 * 2. A field is zero-padded only when a larger field precedes it. `1m05s` holds its width for
 *    a whole minute, which is where the jitter would otherwise be. `01m05s` would pad the
 *    leading field too, and that buys stability the eye never needed at the cost of a
 *    character and a stopwatch look. So the width steps up at 10s and at 10m, twice per
 *    scale, and never on an ordinary tick.
 */
export function formatDuration(ms: number): string {
	// Nothing is knowable from NaN or Infinity, and an invented figure beside a real cost
	// figure gets read as fact. Say instead that there is no number.
	if (!Number.isFinite(ms)) return "--";
	// A negative input is not a negative duration. It is one clock read against another: the
	// server stamps `startedAt` and the browser subtracts it, and a browser running a few
	// seconds behind makes a point that just opened look like it opened in the future.
	const total = Math.round(Math.max(0, ms));
	// Under a second the unit changes rather than the precision, because `0s` would tell the
	// person that a 300ms tool call took no time at all. Width is free to move here: the timer
	// below fires once a second, so a live point passes through this branch at most once.
	if (total < SECOND) return `${total}ms`;
	// Floor, not round, from here down. The figure must never claim a second that has not
	// finished, so that what it says has passed has actually passed.
	const seconds = Math.floor(total / SECOND);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(total / MINUTE);
	if (minutes < 60) return `${minutes}m${pad(seconds % 60)}s`;
	return `${Math.floor(total / HOUR)}h${pad(minutes % 60)}m`;
}

/** How often a live point reads the clock. See `useWorked` for why it is this and not less. */
const TICK = SECOND;

/**
 * Milliseconds this window has spent working: fixed while it is idle, ticking while it is not.
 *
 * Working time, not age, and the two are nowhere near each other here. A delegated window
 * that has answered is deliberately never closed — it is still a live context somebody can
 * walk into and question — so a figure measured from `startedAt` counted upwards for as long
 * as the server stayed up, and a point that answered in forty seconds an hour ago read
 * "1h 02m". The clock now belongs to the trace, which starts it and banks it around every
 * turn, and this only adds the stretch in progress.
 *
 * One second is the coarsest interval that still catches every change `formatDuration` can
 * show below the hour scale. Anything faster re-renders a point to paint the same characters.
 * That matters because the interval is paid per point, not per screen: a research run has
 * dozens of windows open at once, and each of them holds its own timer.
 */
export function useWorked(worked: number, busySince: number | undefined): number {
	const [now, setNow] = useState(() => Date.now());
	const running = busySince !== undefined;

	// The dependency is the boolean, not `busySince`. What the effect does turns on one fact —
	// is this window working — so the timer is built once and torn down once, and no render
	// that leaves that answer unchanged can restart it.
	useEffect(() => {
		// An idle point schedules nothing at all. A timer left on a finished point is a leak
		// with no symptom: it wakes up forever to compute a number that cannot change again.
		if (!running) return;
		const timer = setInterval(() => setNow(Date.now()), TICK);
		return () => clearInterval(timer);
	}, [running]);

	// `busySince` was stamped by the server and `now` is read from this browser, so a clock a
	// few seconds apart would otherwise show a point that has been working for minus one
	// second. A bad measurement is worth nothing; it is not a negative duration.
	return busySince === undefined ? worked : worked + Math.max(0, now - busySince);
}
