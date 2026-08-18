/**
 * The `finish` tool: an agent says its work is complete, and whoever is driving it stops.
 *
 * It exists because the alternative is inference. A driver that decides "the turn opened no
 * subagents, so it must be done" reads a shape and guesses an intent, and it guesses wrong
 * on the turn where the agent simply thought before acting. The same reasoning as the edge
 * kinds on the graph: the intent is declared, never derived.
 *
 * It carries no answer. `record.ts` already makes the last assistant text the window's
 * summary, and that is the prose a person reads and a caller receives. An `answer` argument
 * would be a second home for the same paragraph, and the two would drift the first time an
 * agent wrote a fuller version in one of them.
 */

import { Type } from "typebox";
import type { Line } from "../line.ts";
import type { Runtime } from "../runtime.ts";

export interface FinishToolOptions {
	runtime: Runtime;
	/**
	 * The line that owns this tool. Held rather than an id for the same reason the delegation
	 * tool holds one: what matters is which line is speaking when the call happens.
	 */
	line: Line;
}

export function createFinishTool(options: FinishToolOptions) {
	const { runtime, line } = options;

	return {
		name: "finish",
		label: "Finish",
		description: [
			"Say that the work is complete, so nothing asks you to carry on.",
			"",
			"Call it when the question you were given is answered, or when you have",
			"established that it cannot be answered with what you can reach. Do not call it",
			"because a step went badly; a failed look-up is a reason to look elsewhere.",
			"",
			"Give your answer as your own reply, in this same turn. This tool records the",
			"decision and nothing else.",
		].join("\n"),
		promptSnippet: "finish - declare the work complete",
		parameters: Type.Object({
			reason: Type.String({
				description: "Why the work is complete, in one sentence.",
			}),
		}),
		async execute(_toolCallId: string, params: any) {
			const reason = String(params?.reason ?? "").trim();
			if (!reason) {
				return {
					content: [
						{
							type: "text" as const,
							text:
								"Say why it is complete. A run that ends with no reason recorded leaves the " +
								"person unable to tell an answered question from an abandoned one.",
						},
					],
					details: { reason },
					isError: true,
				};
			}

			runtime.declareFinish(line.id, reason);
			return {
				content: [
					{
						type: "text" as const,
						text:
							"Recorded. Nothing will ask you to continue after this turn, so write your " +
							"answer now, in full. Anything you leave for later will not be asked for.",
					},
				],
				details: { reason },
			};
		},
	};
}
