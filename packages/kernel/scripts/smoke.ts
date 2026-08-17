/**
 * One real run, end to end, so the call tree is proved against a live model rather than
 * against a fake that emits whatever the tests expect.
 *
 * It asks a lead agent to delegate to two specialists, then prints the tree it recorded.
 * Run it with: node --experimental-strip-types packages/kernel/scripts/smoke.ts
 */

import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { AgentRegistry } from "../src/agents/types.ts";
import { Runtime } from "../src/runtime.ts";
import type { TraceNode } from "../src/trace/types.ts";

const registry = new AgentRegistry([
	{
		name: "lead",
		description: "Plans the work and delegates it. Does no research itself.",
		systemPrompt: [
			"You coordinate specialists. You do not answer questions yourself.",
			"For every question you are given, delegate with the `subagent` tool, then write",
			"one short paragraph combining what came back. Name which agent said what.",
			"Use parallel mode when the parts do not depend on each other.",
		].join("\n"),
		tools: [],
		canDelegate: true,
	},
	{
		name: "arithmetic",
		description: "Answers a small arithmetic question. Returns the number and one sentence.",
		systemPrompt: "Answer the arithmetic question. Reply with the number and one sentence. Do not use tools.",
		tools: [],
	},
	{
		name: "definition",
		description: "Defines one term in two sentences, plainly, with no examples.",
		systemPrompt: "Define the term in exactly two plain sentences. Do not use tools.",
		tools: [],
	},
]);

const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel("deepseek", "deepseek-v4-pro");
if (!model) throw new Error("deepseek-v4-pro is not available; check ~/.pi/agent/auth.json");

const runtime = new Runtime({ runId: "smoke", registry, modelRuntime, model, maxDepth: 2 });

runtime.trace.subscribe((event) => {
	if (event.type === "node_open") {
		console.log(`  open  ${event.node.agent}: ${event.node.task.slice(0, 60)}`);
	}
	if (event.type === "step_open") console.log(`  step  ${event.step.title}`);
	if (event.type === "node_close") {
		console.log(`  close ${event.node.agent} -> ${event.node.state}`);
	}
});

const { nodeId, session, stop } = await runtime.openRoot(
	registry.get("lead"),
	"Two things: what is 17 * 23, and what does 'residual stress' mean in metallurgy?",
);

try {
	await session.prompt(
		"Two things: what is 17 * 23, and what does 'residual stress' mean in metallurgy?",
	);
	runtime.trace.closeNode(nodeId, "done");
} finally {
	stop();
	session.dispose();
}

console.log("\n--- call tree ---");
print(runtime.trace.node(nodeId), "");

function print(node: TraceNode, indent: string): void {
	const spend = runtime.trace.rollupUsage(node.id);
	console.log(
		`${indent}${node.agent} [${node.state}] $${spend.cost.total.toFixed(4)} ${spend.totalTokens} tok`,
	);
	if (node.summary) console.log(`${indent}  = ${node.summary.replaceAll("\n", " ").slice(0, 140)}`);
	for (const step of node.steps) {
		console.log(`${indent}  . ${step.title} [${step.state}]`);
		for (const childId of step.childIds ?? []) print(runtime.trace.node(childId), `${indent}    `);
	}
}
