/**
 * Fold a window's tool calls into runs, so the panel keeps the shape of what happened.
 *
 * One row per call was honest and unreadable. A worker researching a topic made twenty-odd
 * `grep` and `read` calls in a row, and the panel became a wall of near-identical lines: the
 * one delegation in the middle of it was the same size as the eighteenth grep, so the reader
 * scrolled past the only row that said what the agent decided.
 *
 * This file groups; it does not draw. It also never reorders. The kernel says the order of
 * the steps is the reasoning, so a grouping that moved a step would describe a run nobody
 * made — and it would look exactly as trustworthy as the true one.
 */

// Type-only, so nothing from the kernel barrel reaches the browser bundle. The barrel
// re-exports `Runtime`, which pulls pi and every model SDK behind it; `import type` is erased
// before the bundler ever follows it.
import type { Step } from "@lumen/kernel";

export interface StepRun {
	/** The tool every step in this run called. */
	tool: string;
	steps: Step[];
	/** One line for the collapsed row: the single step's own title, or a count. */
	title: string;
}

/**
 * Steps that keep their own row whatever their neighbours did.
 *
 * Collapsing is a trade: the reader gives up a row to get the shape back. These three are
 * the rows that carry the shape, so folding them away spends the thing the panel is for.
 */
function standsAlone(step: Step): boolean {
	// It opened windows, so it is the tree. The renderer hangs a line per child under this
	// row, and the kernel writes `childIds` precisely to turn a flat list of calls into a
	// call tree. Inside "7 subagent calls" that tree has nowhere to be drawn.
	//
	// Tested on `childIds` and not on the tool name, for the same reason the kernel sets it
	// that way: a call to a spawning tool that spawned nothing is an ordinary call, and a
	// future tool that spawns will be caught here without this file learning its name.
	if (step.childIds?.length) return true;

	// It broke, or someone stopped it. This is the row a person opens the panel to find, and
	// a run carries one title and no state — so a failed grep buried in "6 grep calls" is
	// drawn as six calls that worked. The count would be true and the picture false.
	if (step.state === "failed" || step.state === "aborted") return true;

	// It has not come back yet. This is the live edge of the window, the one row that says
	// where the agent is right now. Folded in beside calls that finished, a call that is
	// hanging reads as part of a finished block, which is the wrong answer to the only
	// question being asked while a run is in flight.
	return step.state === "running";
}

/**
 * The one line a collapsed run shows.
 *
 * The noun is `calls`, not a plural of the tool: `lss` and `bashs` are not words, and a title
 * that reads as a typo costs more trust than the row is worth. The plural is unconditional
 * because a run of one keeps the step's own title, so this never has to say "1 grep call".
 */
function runTitle(tool: string, count: number): string {
	return `${count} ${tool} calls`;
}

/**
 * Group consecutive calls to the same tool, in order.
 *
 * Consecutive, never merely equal. Two greps, a read, then two more greps is three runs. One
 * run of four greps would put a step ahead of a step it actually followed, which is the same
 * lie as sorting the list.
 */
export function groupSteps(steps: Step[]): StepRun[] {
	const runs: StepRun[] = [];
	// The run a following step may still join. A run holding a step that stands alone is
	// never this, so a grep after a grep that spawned starts a fresh run instead of joining
	// the one that already closed.
	let open: StepRun | null = null;

	for (const step of steps) {
		if (standsAlone(step)) {
			runs.push({ tool: step.tool, steps: [step], title: step.title });
			open = null;
			continue;
		}
		if (open && open.tool === step.tool) {
			open.steps.push(step);
			open.title = runTitle(step.tool, open.steps.length);
			continue;
		}
		open = { tool: step.tool, steps: [step], title: step.title };
		runs.push(open);
	}

	return runs;
}
