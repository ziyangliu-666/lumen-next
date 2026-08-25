/**
 * The findings graph, checked without a model.
 *
 * Same shape as `trace.test.ts`, because `IdeaGraph` deliberately mirrors `Trace`: one
 * structure, published as it changes, snapshotted for a client that just connected.
 */

import { describe, expect, it } from "vitest";
import { IdeaGraph } from "../src/ideas.ts";
import type { IdeaEvent } from "../src/ideas.ts";

describe("IdeaGraph", () => {
	it("emits idea_add with the right shape when an idea is added", () => {
		const graph = new IdeaGraph("run-1");
		const events: IdeaEvent[] = [];
		graph.subscribe((event) => events.push(event));

		const idea = graph.add({
			title: "the bug is a race",
			summary: "two writers touch the same field",
			kind: "finding",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: ["n-2"],
		});

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "idea_add", idea });
		expect(idea.title).toBe("the bug is a race");
		expect(idea.summary).toBe("two writers touch the same field");
		expect(idea.kind).toBe("finding");
		expect(idea.nodeId).toBe("n-1");
		expect(idea.parentId).toBeNull();
		expect(idea.citedNodeIds).toEqual(["n-2"]);
		expect(typeof idea.createdAt).toBe("number");
	});

	it("gives ideas an id apart from trace node ids, so the two never look alike", () => {
		const graph = new IdeaGraph("run-1");
		const idea = graph.add({
			title: "t",
			summary: "s",
			kind: "idea",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: [],
		});
		expect(idea.id).toMatch(/^i-/);
	});

	it("get and list return what was added", () => {
		const graph = new IdeaGraph("run-1");
		const first = graph.add({
			title: "a",
			summary: "s1",
			kind: "idea",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: [],
		});
		const second = graph.add({
			title: "b",
			summary: "s2",
			kind: "direction",
			nodeId: "n-2",
			parentId: null,
			citedNodeIds: [],
		});

		expect(graph.get(first.id)).toEqual(first);
		expect(graph.get(second.id)).toEqual(second);
		expect(graph.get("i-nope")).toBeUndefined();
		expect(graph.list()).toEqual([first, second]);
	});

	it("keys a second idea under its parent's id in the children index", () => {
		const graph = new IdeaGraph("run-1");
		const parent = graph.add({
			title: "root finding",
			summary: "s1",
			kind: "direction",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: [],
		});
		const child = graph.add({
			title: "grows from it",
			summary: "s2",
			kind: "finding",
			nodeId: "n-2",
			parentId: parent.id,
			citedNodeIds: [],
		});

		const snapshot = graph.snapshot();
		expect(snapshot.children[parent.id]).toEqual([child.id]);
	});

	it("keys a root idea (parentId null) under the empty string", () => {
		const graph = new IdeaGraph("run-1");
		const root = graph.add({
			title: "root finding",
			summary: "s1",
			kind: "finding",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: [],
		});

		const snapshot = graph.snapshot();
		expect(snapshot.children[""]).toEqual([root.id]);
		expect(snapshot.ideas[root.id]).toEqual(root);
	});

	it("survives a listener that throws, because a reader must not kill the work", () => {
		const graph = new IdeaGraph("run-1");
		graph.subscribe(() => {
			throw new Error("the interface fell over");
		});
		expect(() =>
			graph.add({
				title: "t",
				summary: "s",
				kind: "idea",
				nodeId: "n-1",
				parentId: null,
				citedNodeIds: [],
			}),
		).not.toThrow();
	});
});

describe("IdeaGraph.restore", () => {
	it("brings back an idea under the exact id it was saved with, parent link included", () => {
		const original = new IdeaGraph("run-1");
		const root = original.add({
			title: "root finding",
			summary: "s1",
			kind: "finding",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: [],
		});
		const child = original.add({
			title: "a direction",
			summary: "s2",
			kind: "direction",
			nodeId: "n-2",
			parentId: root.id,
			citedNodeIds: [],
		});

		const revived = new IdeaGraph("run-2");
		revived.restore(original.snapshot());

		expect(revived.get(root.id)).toEqual(root);
		expect(revived.get(child.id)).toEqual(child);
		expect(revived.snapshot().children[root.id]).toEqual([child.id]);
	});

	it("never mints an id a restored idea already holds", () => {
		const original = new IdeaGraph("run-1");
		for (let i = 0; i < 5; i += 1) {
			original.add({
				title: `t${i}`,
				summary: "s",
				kind: "idea",
				nodeId: "n-1",
				parentId: null,
				citedNodeIds: [],
			});
		}
		const snapshot = original.snapshot();
		const restoredIds = new Set(Object.keys(snapshot.ideas));

		const revived = new IdeaGraph("run-2");
		revived.restore(snapshot);
		const fresh = revived.add({
			title: "fresh",
			summary: "s",
			kind: "idea",
			nodeId: "n-1",
			parentId: null,
			citedNodeIds: [],
		});

		expect(restoredIds.has(fresh.id)).toBe(false);
	});
});
