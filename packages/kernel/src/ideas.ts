/**
 * The findings graph, and the store that publishes every change to it.
 *
 * `Trace` is the mechanism: it says which context window ran, who opened it, and what it
 * cost. `IdeaGraph` is the product: it says what was actually found. The two are deliberately
 * separate structures rather than one enriched with a "finding" flag, because they answer
 * different questions and grow at different rates. A window can run for an hour, call a
 * dozen tools, and settle nothing worth remembering; another can answer in one turn and be
 * the whole reason the run mattered. Counting windows would draw the first one bigger.
 *
 * An idea always has exactly one declaring point: `nodeId`, the window it was declared from.
 * That is its one, unambiguous location, the same way a `TraceNode`'s `id` is its. A point,
 * in turn, may have declared zero, one, or several ideas — a window that read three files and
 * found nothing worth keeping declares none; one that settled three separate questions
 * declares three. `citedNodeIds` is a different relationship and must not be confused with
 * `nodeId`: it names other points whose work supports this finding, the same way a paper
 * cites sources without being written by them.
 *
 * Ideas can also cite each other, through `parentId`. That is a claim about the reasoning —
 * this finding grew out of that one — and it is what turns a flat list of results into a
 * tree a person can follow. `nodeId` and `parentId` answer different questions and neither
 * substitutes for the other: `nodeId` is where an idea was said, `parentId` is what it grew
 * from, and a single idea can easily have both pointing at different things — a worker three
 * delegations deep confirming a hypothesis the lead first raised at the root.
 *
 * The shape mirrors `Trace` on purpose: one store, `emit`/`subscribe` for the interface,
 * `snapshot` for a client that just connected. Same pattern, because the reason for it is
 * the same reason — a picture built from a second copy of the data drifts from the model
 * that produced it, silently, and this is the one place both the engine and the interface
 * read from.
 */

/**
 * Where an idea stands, not what it says.
 *
 * "idea" is a raw hypothesis, said before anything has tested it. "direction" is a path
 * someone chose to pursue — proposed, still open, not yet resolved either way — and it is
 * the one kind that can also be live: a direction whose declaring point is still busy is the
 * frontier of the research, the thing actually happening right now. "finding" is a settled
 * result, proved or disproved or otherwise concluded; whichever way it landed, the question
 * that produced it is closed.
 *
 * A direction resolving is not this field changing on the direction itself — ideas are never
 * edited after they are declared, only added to, the same rule `discover.ts` states for the
 * tool that creates them. The resolution is a new "finding" idea whose `parentId` points back
 * at the direction, so the graph keeps the direction's own record of what was open, and when.
 */
export type IdeaKind = "idea" | "direction" | "finding";

export interface Idea {
	id: string;
	title: string;
	summary: string;
	kind: IdeaKind;
	/** The point (TraceNode id) this was declared from — its one, unambiguous location. */
	nodeId: string;
	/** The idea this grew from, if any. Null for a new line of inquiry. */
	parentId: string | null;
	/**
	 * Other points cited in `summary` via @n-id, that actually exist. Not the location —
	 * supporting evidence, same convention the composer already uses for @-references.
	 */
	citedNodeIds: string[];
	createdAt: number;
}

export interface IdeaSnapshot {
	ideas: Record<string, Idea>;
	/**
	 * Child idea ids per parent id, in the order they were declared. Root ideas are keyed
	 * under the empty string "" (there is no synthetic root id to invent).
	 */
	children: Record<string, string[]>;
}

export type IdeaEvent = { type: "idea_add"; idea: Idea };

let counter = 0;
function nextId(): string {
	counter += 1;
	// "i-" rather than "n-": an idea id sitting next to a node id in the same sentence — as
	// a `parentId` beside a `nodeId` often will — has to read apart at a glance, not just on
	// close reading.
	return `i-${counter.toString(36)}`;
}

/** If `id` is one `nextId` could have minted, make sure `nextId` never mints it again. */
function bumpCounterPast(id: string): void {
	if (!id.startsWith("i-")) return;
	const value = Number.parseInt(id.slice(2), 36);
	if (Number.isFinite(value) && value > counter) counter = value;
}

export class IdeaGraph {
	readonly runId: string;
	private readonly ideasById = new Map<string, Idea>();
	private readonly childIds = new Map<string, string[]>();
	private readonly listeners = new Set<(event: IdeaEvent) => void>();

	constructor(runId: string) {
		this.runId = runId;
	}

	subscribe(listener: (event: IdeaEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	add(input: {
		title: string;
		summary: string;
		kind: IdeaKind;
		nodeId: string;
		parentId: string | null;
		citedNodeIds: string[];
	}): Idea {
		const idea: Idea = {
			id: nextId(),
			title: input.title,
			summary: input.summary,
			kind: input.kind,
			nodeId: input.nodeId,
			parentId: input.parentId,
			citedNodeIds: input.citedNodeIds,
			createdAt: Date.now(),
		};
		this.ideasById.set(idea.id, idea);
		const key = idea.parentId ?? "";
		this.childIds.set(key, [...(this.childIds.get(key) ?? []), idea.id]);
		this.emit({ type: "idea_add", idea });
		return idea;
	}

	get(id: string): Idea | undefined {
		return this.ideasById.get(id);
	}

	list(): Idea[] {
		return [...this.ideasById.values()];
	}

	snapshot(): IdeaSnapshot {
		return {
			ideas: Object.fromEntries(
				[...this.ideasById.entries()].map(([id, idea]) => [id, structuredClone(idea)]),
			),
			children: Object.fromEntries(
				[...this.childIds.entries()].map(([id, ids]) => [id, [...ids]]),
			),
		};
	}

	/**
	 * Seed this graph from a snapshot read off disk, keeping every id exactly as it was —
	 * see `Trace.restore`'s own comment for why identity, not just content, is the point.
	 * Call this once, on an `IdeaGraph` fresh out of its constructor.
	 */
	restore(snapshot: IdeaSnapshot): void {
		this.ideasById.clear();
		this.childIds.clear();
		for (const [id, idea] of Object.entries(snapshot.ideas)) {
			this.ideasById.set(id, structuredClone(idea));
			bumpCounterPast(id);
		}
		for (const [id, ids] of Object.entries(snapshot.children)) {
			this.childIds.set(id, [...ids]);
		}
	}

	emit(event: IdeaEvent): void {
		for (const listener of this.listeners) {
			// The same rule as `Trace.emit`: one broken listener must not stop the others, and
			// must never stop the run. The interface is a reader here, not a participant.
			try {
				listener(event);
			} catch (error) {
				console.error("idea listener threw", error);
			}
		}
	}
}
