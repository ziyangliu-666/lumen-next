/**
 * The `discover` tool: an agent says it found something, and the finding gets a place in
 * the graph a person actually watches.
 *
 * `finish` says a line of work is done; `discover` says something specific was learned along
 * the way, and the two are unrelated. A run can discover three things and never call `finish`
 * because the person is still watching it work; a run can call `finish` having discovered
 * nothing, because the honest answer was "not found". Neither implies the other.
 *
 * It is deliberately narrow. This tool does not replace the agent's own reply — the prose in
 * the reply is still what a caller reads, the same way `finish` carries no answer of its own.
 * What this adds is a second, durable structure: a small graph of findings that survives past
 * the turn that produced them, that a later idea can point back to with `parent`, and that
 * the interface draws as the thing the run actually produced.
 */

import { Type } from "typebox";
import type { Line } from "../line.ts";
import type { Runtime } from "../runtime.ts";

export interface DiscoverToolOptions {
	runtime: Runtime;
	/**
	 * The line that owns this tool, read late for the same reason every other tool here
	 * reads it late: a line's current window can rotate mid-conversation, and a finding
	 * belongs to the window that was live when it was declared, not the one that existed
	 * when the tool was built.
	 */
	line: Line;
}

/** The same citation syntax the composer already reads out of what a person types. */
const CITATION = /@(n-[a-z0-9]+)/g;

export function createDiscoverTool(options: DiscoverToolOptions) {
	const { runtime, line } = options;

	return {
		name: "discover",
		label: "Discover",
		description: [
			"Record a real finding: a result someone should be able to look back at later and",
			"see was worth recording. Not every answer, and not every intermediate step — a",
			"file you read or a command you ran is not a finding on its own, only what it",
			"told you.",
			"",
			"Give a short `title` and a `summary` in prose. Cite supporting points in `summary`",
			"with `@n-id` the same way the composer does; anything that is not a real point is",
			"quietly dropped rather than failing the call.",
			"",
			"Say what kind of idea this is with `kind`. \"idea\" is a raw hypothesis, not tested",
			"yet. \"direction\" is a path you are choosing to pursue, open and not yet resolved",
			"either way. \"finding\" is a settled result, proved or disproved or otherwise",
			"concluded — the question behind it is closed, whichever way it landed.",
			"",
			"Set `parent` to an earlier idea's id when this one grows out of it, so the graph",
			"reads as a line of reasoning rather than a pile of unrelated notes. Leave it out",
			"for a new line of inquiry. A direction is never edited into a finding: record the",
			"resolution as a new \"finding\" idea with the direction as its `parent`.",
		].join("\n"),
		promptSnippet: "discover - record a real finding in the findings graph",
		parameters: Type.Object({
			title: Type.String({ description: "Short label for the graph node." }),
			summary: Type.String({
				description:
					"The finding itself, in prose. Cite supporting points with @n-id, the same syntax you already use when talking to a person.",
			}),
			kind: Type.Union(
				[Type.Literal("idea"), Type.Literal("direction"), Type.Literal("finding")],
				{
					description:
						'"idea" for an untested hypothesis, "direction" for a path you are pursuing that is still open, "finding" for a settled result — proved, disproved, or otherwise concluded.',
				},
			),
			parent: Type.Optional(
				Type.String({
					description:
						"The id of an earlier idea (an i-... id from a previous discover call) this one grows from. Omit for a new, independent line of inquiry.",
				}),
			),
		}),
		async execute(_toolCallId: string, params: any) {
			const title = String(params?.title ?? "").trim();
			const summary = String(params?.summary ?? "").trim();
			if (!title || !summary) {
				return errorResult("Give both `title` and `summary`: what was found, and a short label for it.");
			}

			const parent = typeof params?.parent === "string" ? params.parent.trim() : "";
			if (parent && !runtime.ideas.get(parent)) {
				return errorResult(
					`No such idea: ${parent}. It has to be the id an earlier \`discover\` call returned, ` +
						"an \"i-...\" id. Leave `parent` out if this is a new line of inquiry rather than " +
						"a continuation of one.",
				);
			}

			// A model citing a made-up point should not fail the call — the finding is still
			// worth recording — so anything that is not a real point is dropped rather than
			// refused. `Trace.node` throws on an unknown id, so each candidate is checked on
			// its own.
			const citedNodeIds = [...summary.matchAll(CITATION)]
				.map((match) => match[1])
				.filter((id, index, all) => all.indexOf(id) === index)
				.filter((id) => {
					try {
						runtime.trace.node(id);
						return true;
					} catch {
						return false;
					}
				});

			const idea = runtime.ideas.add({
				title,
				summary,
				kind: params?.kind,
				nodeId: line.currentNodeId,
				parentId: parent || null,
				citedNodeIds,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Recorded as ${idea.id}: "${idea.title}". Name it as \`parent\` if a later finding grows from it.`,
					},
				],
				details: { id: idea.id, parentId: idea.parentId, citedNodeIds: idea.citedNodeIds },
			};
		},
	};
}

function errorResult(text: string) {
	return {
		content: [{ type: "text" as const, text }],
		details: { id: null, parentId: null, citedNodeIds: [] as string[] },
		isError: true,
	};
}
