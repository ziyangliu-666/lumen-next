/**
 * What the composer offers to finish for you.
 *
 * Two triggers, and they are here for opposite reasons.
 *
 * `@` is the one that had to exist. A point's id is `n-1`, `n-a`, `n-14` — a base-36 counter
 * nobody can hold in their head, so `@`-referencing a point was only ever usable by reading
 * an id off the screen and copying it by hand. A row of buttons used to do that job and was
 * removed for being a second way to type; this is the first way, made possible.
 *
 * `/` is deliberately thin. Every command here is something that is otherwise buried — the
 * way out of a dead conversation lives at the bottom of a modal, below the fold — and
 * nothing here duplicates a control already visible in the header. A command that shadows a
 * button in plain sight is the same "two ways to do one thing" this file's `@` half exists
 * to remove.
 */

import type { TraceNode } from "@lumen/kernel";

/** One row of the menu. `insert` is what replaces the token the person is typing. */
export interface Suggestion {
	/** Stable across re-renders while the query narrows, so React keeps the same row. */
	id: string;
	/** The token itself: `@n-3`, `/new`. */
	label: string;
	/** What it means, in a few words. */
	detail: string;
	/** Text to put in place of the trigger token. Commands insert nothing; they act. */
	insert?: string;
	/** Named for the composer to run when this is a command rather than a reference. */
	command?: "new" | "stop" | "settings" | "conversations";
}

/**
 * The trigger the caret is currently inside, if any.
 *
 * `start` is where the token begins, so accepting a suggestion knows exactly what to
 * replace: everything from the trigger character up to the caret, and nothing either side.
 */
export interface Trigger {
	kind: "@" | "/";
	query: string;
	start: number;
}

/**
 * Read the token the caret sits in.
 *
 * A trigger only counts at the start of a word — `foo@bar` is an email address, not a
 * reference, and a person typing one should not be interrupted by a menu. `/` is narrower
 * still: only at the very start of the box, because a slash anywhere else is a slash in a
 * path or a date, which is far more common in this app than a command would be.
 */
export function triggerAt(text: string, caret: number): Trigger | null {
	// Only what is behind the caret matters; a trigger is never completed from the right.
	const before = text.slice(0, caret);
	const at = before.lastIndexOf("@");
	const slash = before.lastIndexOf("/");
	const start = Math.max(at, slash);
	if (start < 0) return null;

	const kind = before[start] as "@" | "/";
	const query = before.slice(start + 1);
	// A space anywhere in the query means the token ended and this is ordinary prose.
	if (/\s/.test(query)) return null;
	if (kind === "/" && start !== 0) return null;
	if (kind === "@" && start > 0 && !/\s/.test(before[start - 1])) return null;
	return { kind, query, start };
}

const COMMANDS: Suggestion[] = [
	{
		id: "cmd-new",
		label: "/new",
		detail: "start a fresh conversation",
		command: "new",
	},
	{
		id: "cmd-conversations",
		label: "/conversations",
		detail: "the other conversations this server holds",
		command: "conversations",
	},
	{ id: "cmd-stop", label: "/stop", detail: "stop what this point is doing", command: "stop" },
	{ id: "cmd-settings", label: "/settings", detail: "budget, model, where this runs", command: "settings" },
];

/** A point's own words, flattened to one line, for the menu row under its id. */
function gist(node: TraceNode): string {
	const text = (node.summary ?? "").replace(/\s+/g, " ").trim();
	return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

/**
 * The rows to offer for a trigger.
 *
 * Points are ordered newest first: a reference is almost always to something just said, and
 * the id counter already puts the newest last, so the list is reversed rather than sorted by
 * a timestamp the node does not carry.
 */
export function suggestionsFor(trigger: Trigger, nodes: TraceNode[]): Suggestion[] {
	const query = trigger.query.toLowerCase();
	if (trigger.kind === "/") {
		return COMMANDS.filter((command) => command.label.slice(1).startsWith(query));
	}
	return nodes
		.filter((node) => (node.summary ?? "").trim().length > 0)
		.filter((node) => {
			if (query.length === 0) return true;
			// Both the bare id and the agent's name, so `@wo` finds a worker and `@3` finds
			// n-3 — a person reaching for one of these rarely remembers which they know.
			return node.id.slice(2).startsWith(query) || node.agent.toLowerCase().startsWith(query);
		})
		.reverse()
		.slice(0, 8)
		.map((node) => ({
			id: node.id,
			label: `@${node.id}`,
			detail: `${node.agent} — ${gist(node)}`,
			insert: `@${node.id} `,
		}));
}

/** Put a suggestion's text where the trigger token was, and say where the caret lands. */
export function applySuggestion(
	text: string,
	trigger: Trigger,
	suggestion: Suggestion,
): { text: string; caret: number } {
	if (!suggestion.insert) return { text, caret: trigger.start };
	const head = text.slice(0, trigger.start);
	const tail = text.slice(trigger.start + 1 + trigger.query.length);
	return { text: head + suggestion.insert + tail, caret: head.length + suggestion.insert.length };
}
