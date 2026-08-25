/**
 * The findings graph: what was actually discovered, drawn as a tree instead of a log.
 *
 * Deliberately not a second `Canvas.tsx`. The call graph can hold dozens of delegated
 * windows and earns its pan-and-zoom canvas; a findings graph is expected to stay small and
 * shallow — a handful of ideas, each with a few children at most — so a static, indented
 * list reads it in full without asking anyone to navigate it first.
 *
 * One finding is one line, and it stays one line until asked. An earlier version always drew
 * the kind, the title, two hundred characters of summary and a "show more" button — four
 * lines each, so a dozen findings could not be seen at once and the shape of the research,
 * which is the entire reason this panel exists, was the first thing lost to scrolling. The
 * summary has not gone anywhere; it is behind the row, one click away.
 *
 * Two affordances, and they are ordered by how often each is wanted. The row itself expands:
 * that is the frequent act, reading what was found, so it gets the whole row and needs no
 * aim. Jumping to the window that declared it is rarer and gets a small mark at the end of
 * the row. They used to be the other way round — the row jumped away, and reading the text
 * took a separate button — which meant a click aimed at prose a person was trying to read
 * moved the reading panel somewhere else instead.
 *
 * A card whose window is the current target is marked `selected`, the same way `Canvas.tsx`
 * rings the point you are standing on. Without it, switching from the call graph to this
 * view dropped the only visual sign of where a typed message would go: the composer still
 * named the target, but small and easy to miss, and this list gave no second confirmation
 * that a click here had — or had not — moved it.
 */

import { useEffect, useRef, useState } from "react";
import type { Idea } from "@lumen/kernel";
import type { State } from "./state.ts";

/**
 * A summary, laid flat. Whitespace collapses, so a summary written across several lines
 * reads as one — the cut below (see `EXCERPT_LIMIT`) is the only thing that shortens it.
 */
function flatten(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/** Open, closed, and the row that has nothing to open — the last drawn as a space so every
 *  title in the list starts at the same column whether or not it has a summary. */
const DISCLOSURE = { open: "▾", closed: "▸", none: " " };

// The same glyph `Canvas.tsx` and `Detail.tsx` already draw for a point that is busy. A
// direction's declaring point going busy again is that same event, so it gets the same mark
// rather than a new symbol a person has to learn.
const BUSY = "◍";

/** How long a newly-arrived card stays highlighted before it fades into an ordinary one. */
const HIGHLIGHT_MS = 2400;

/**
 * Which ids in `ideas` arrived after this hook first ran, for a fading highlight — not which
 * ids exist, which `state.ideas` already answers.
 *
 * A person reconnecting, or opening a run for the first time, sees the whole findings graph
 * appear at once; none of those are "new arrivals", they are just the graph as it already
 * stood. So the id set the hook first observes is remembered as the baseline and never
 * highlighted — only an id that shows up in a later run, after a genuine `idea_add`, counts.
 */
function useNewlyArrived(ideas: State["ideas"]): Set<string> {
	const seen = useRef<Set<string> | null>(null);
	const [fresh, setFresh] = useState<Set<string>>(() => new Set());

	useEffect(() => {
		const ids = Object.keys(ideas);
		if (seen.current === null) {
			seen.current = new Set(ids);
			return;
		}
		const added = ids.filter((id) => !seen.current?.has(id));
		if (added.length === 0) return;
		for (const id of added) seen.current.add(id);
		setFresh((current) => new Set([...current, ...added]));
		const timer = window.setTimeout(() => {
			setFresh((current) => {
				const next = new Set(current);
				for (const id of added) next.delete(id);
				return next;
			});
		}, HIGHLIGHT_MS);
		return () => window.clearTimeout(timer);
		// `ideas` itself, not a derived array of its keys: `state.ts`'s reducer only ever
		// replaces this object on `hello` or `idea_add`, so its identity is already the
		// signal "the set of ideas changed" — recomputing `Object.keys` on every unrelated
		// render just to diff against itself would be work with no different answer.
	}, [ideas]);

	return fresh;
}

export function IdeaGraph({ state, onSelect }: { state: State; onSelect: (nodeId: string) => void }) {
	const fresh = useNewlyArrived(state.ideas);
	const roots = state.ideaChildren[""] ?? [];

	if (roots.length === 0) {
		return (
			<div className="ideaEmpty">
				Nothing has been discovered yet. Once an agent calls <code>discover</code> on a real
				finding, it appears here as a point in the graph, not just a line in an answer.
			</div>
		);
	}

	return (
		<div className="ideaGraph">
			<ul className="ideaList">
				{roots.map((id) => (
					<IdeaItem key={id} id={id} state={state} onSelect={onSelect} fresh={fresh} />
				))}
			</ul>
		</div>
	);
}

function IdeaItem({
	id,
	state,
	onSelect,
	fresh,
}: {
	id: string;
	state: State;
	onSelect: (nodeId: string) => void;
	fresh: Set<string>;
}) {
	const idea = state.ideas[id];
	if (!idea) return null;
	const children = state.ideaChildren[id] ?? [];

	return (
		<li className="ideaNode">
			<IdeaCard idea={idea} state={state} onSelect={onSelect} justArrived={fresh.has(id)} />
			{children.length > 0 && (
				<ul className="ideaList">
					{children.map((childId) => (
						<IdeaItem key={childId} id={childId} state={state} onSelect={onSelect} fresh={fresh} />
					))}
				</ul>
			)}
		</li>
	);
}

function IdeaCard({
	idea,
	state,
	onSelect,
	justArrived,
}: {
	idea: Idea;
	state: State;
	onSelect: (nodeId: string) => void;
	/** This card's id was not in the set the moment this panel started watching — see
	 *  `useNewlyArrived`. Drawn with a highlight that fades, so a finding added at the
	 *  bottom of a long list, possibly below the fold, does not arrive with no ceremony. */
	justArrived: boolean;
}) {
	// Only a "direction" is ever live: an "idea" is not yet being worked, and a "finding" is
	// already settled, so neither has a frontier to point at.
	const busy = idea.kind === "direction" && state.nodes[idea.nodeId]?.busy === true;
	const selected = state.selected === idea.nodeId;
	const [expanded, setExpanded] = useState(false);

	const summary = flatten(idea.summary);
	// A finding whose summary says nothing beyond its own title has nothing to reveal, so it
	// gets no triangle and does not respond to a click — an affordance that opens onto a
	// repeat of the line above it teaches a person that opening is not worth doing.
	const hasMore = summary.length > 0 && summary !== flatten(idea.title);

	return (
		<div className={`idea${selected ? " selected" : ""}${justArrived ? " justArrived" : ""}`}>
			<div className="ideaRow">
				<button
					type="button"
					className="ideaToggle"
					onClick={() => hasMore && setExpanded((value) => !value)}
					aria-expanded={hasMore ? expanded : undefined}
					disabled={!hasMore}
					title={hasMore ? (expanded ? "collapse" : "read what it says") : undefined}
				>
					<span className="ideaMark">
						{hasMore ? (expanded ? DISCLOSURE.open : DISCLOSURE.closed) : DISCLOSURE.none}
					</span>
					<span className={`ideaKind ${idea.kind}`}>{idea.kind}</span>
					{busy && <span className="mark running">{BUSY}</span>}
					<span className="ideaTitle">{idea.title}</span>
				</button>
				<button
					type="button"
					className="ideaGoto"
					onClick={() => onSelect(idea.nodeId)}
					title="open the window this was declared from"
				>
					↗
				</button>
			</div>
			{expanded && <div className="ideaExcerpt">{summary}</div>}
		</div>
	);
}
