/**
 * The runtime: it owns the model, the agent registry and the trace, and it is the one
 * thing that knows how to turn "run agent X on task Y" into a live pi session.
 *
 * Subagents run **in this process**, as nested `AgentSession`s, rather than as child
 * `pi` processes the way pi's own example does. The trade is deliberate:
 *
 *   in-process   the child's events arrive directly, so the interface can show a
 *                subagent working without a second protocol between us and it. This is
 *                the whole reason the call tree is free rather than built by hand.
 *   subprocess   real isolation, at the price of inventing that protocol.
 *
 * Isolation comes back later from a container around the whole run, which is where it
 * belongs anyway: an in-process child sandboxed from its parent protects nothing, since
 * both hold the same file handles.
 */

import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
	type ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import type { AgentRegistry, AgentSpec } from "./agents/types.ts";
import { record } from "./trace/record.ts";
import { Trace } from "./trace/trace.ts";

export interface RuntimeOptions {
	runId: string;
	registry: AgentRegistry;
	modelRuntime: ModelRuntime;
	/** Model for agents that do not name one. */
	model?: any;
	cwd?: string;
	/**
	 * How deep delegation may go. Reaching it is an error the parent sees, not a silent
	 * truncation: an agent told "you may not delegate" can do the work itself, and an
	 * agent whose delegation quietly returned nothing reports success on an empty result.
	 */
	maxDepth?: number;
	/** How many subagents may run at once inside one parallel call. */
	maxConcurrent?: number;
}

export interface SpawnRequest {
	agent: string;
	task: string;
	/** The node that asked for this. */
	parentNodeId: string;
	/** The tool call that asked for it, so the tree links to the right step. */
	stepId: string;
	depth: number;
}

export interface SpawnResult {
	nodeId: string;
	agent: string;
	ok: boolean;
	/** What the child returned, which is what the parent will read. */
	output: string;
	error?: string;
}

export class Runtime {
	readonly trace: Trace;
	readonly registry: AgentRegistry;
	readonly maxDepth: number;
	readonly maxConcurrent: number;
	private readonly options: RuntimeOptions;

	constructor(options: RuntimeOptions) {
		this.options = options;
		this.registry = options.registry;
		this.trace = new Trace(options.runId);
		this.maxDepth = options.maxDepth ?? 3;
		this.maxConcurrent = options.maxConcurrent ?? 4;
	}

	/**
	 * Run one agent on one task and return what it said.
	 *
	 * The trace node is opened before the session exists and closed in a `finally`, so a
	 * child that throws on its first turn still appears on screen with a reason. A node
	 * that is only created on success is a node that never explains a failure.
	 */
	async spawn(request: SpawnRequest, signal?: AbortSignal): Promise<SpawnResult> {
		const spec = this.registry.get(request.agent);
		const node = this.trace.openNode({
			parentId: request.parentNodeId,
			agent: spec.name,
			task: request.task,
			model: spec.model,
		});
		this.trace.linkChild(request.parentNodeId, request.stepId, node.id);

		if (request.depth > this.maxDepth) {
			const error = `delegation depth ${request.depth} exceeds the limit of ${this.maxDepth}`;
			this.trace.closeNode(node.id, "failed", { error });
			return { nodeId: node.id, agent: spec.name, ok: false, output: "", error };
		}

		let stop: (() => void) | undefined;
		let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
		try {
			session = await this.createSession(spec, node.id, request.depth);
			stop = record(this.trace, node.id, session);
			const onAbort = () => void session?.abort();
			signal?.addEventListener("abort", onAbort, { once: true });
			try {
				await session.prompt(request.task);
			} finally {
				signal?.removeEventListener("abort", onAbort);
			}
			const output = this.trace.node(node.id).summary ?? "";
			const aborted = signal?.aborted === true;
			this.trace.closeNode(node.id, aborted ? "aborted" : "done", { summary: output });
			return { nodeId: node.id, agent: spec.name, ok: !aborted, output };
		} catch (cause) {
			const error = cause instanceof Error ? cause.message : String(cause);
			this.trace.closeNode(node.id, "failed", { error });
			return { nodeId: node.id, agent: spec.name, ok: false, output: "", error };
		} finally {
			stop?.();
			session?.dispose();
		}
	}

	/** Open the run's own top-level session. Its node is the root of the trace. */
	async openRoot(spec: AgentSpec, task: string) {
		const node = this.trace.openNode({ parentId: null, agent: spec.name, task, model: spec.model });
		const session = await this.createSession(spec, node.id, 0);
		const stop = record(this.trace, node.id, session);
		return { nodeId: node.id, session, stop };
	}

	private async createSession(spec: AgentSpec, nodeId: string, depth: number) {
		// Imported here rather than at the top because the tool needs the runtime, and a
		// top-level import would make runtime.ts and subagent.ts a cycle.
		const { createSubagentTool } = await import("./tools/subagent.ts");
		const customTools = spec.canDelegate
			? [createSubagentTool({ runtime: this, nodeId, depth: depth + 1 })]
			: [];

		const cwd = this.options.cwd ?? process.cwd();
		// Extensions, skills and context files are all discovered from the working
		// directory, and the working directory is full of the user's own material. An
		// agent that loads configuration from there is an agent whose instructions the
		// content it is reading can rewrite. The system prompt comes from the spec and
		// from nowhere else.
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			agentDir: getAgentDir(),
			systemPrompt: spec.systemPrompt,
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
		});
		await resourceLoader.reload();

		const { session } = await createAgentSession({
			cwd,
			model: this.options.model,
			modelRuntime: this.options.modelRuntime,
			resourceLoader,
			// In memory: a subagent's transcript belongs to this run's trace, not to a
			// separate session file the user would have to find and correlate by hand.
			sessionManager: SessionManager.inMemory(),
			...toolSelection(spec, customTools.length > 0),
			customTools,
		});
		return session;
	}
}

/** The tool name the delegation tool registers under. Kept here so the allowlist can name it. */
export const SUBAGENT_TOOL = "subagent";

/**
 * Turn a spec's tool list into pi's own options.
 *
 * pi reads `tools` as "enable exactly these", not as "restrict the built-ins". So an
 * empty list does not mean "no file tools, keep my custom ones" — it means no tools at
 * all, including the delegation tool. A lead agent configured that way still tries to
 * delegate: it writes the tool call out as plain text, the text goes nowhere, and the
 * run looks like it worked. That is measured, not feared; it is what the first real run
 * of this code did.
 */
function toolSelection(
	spec: AgentSpec,
	hasDelegation: boolean,
): { tools?: string[]; noTools?: "all" | "builtin" } {
	if (spec.tools === undefined) return {};
	if (spec.tools.length === 0) {
		// Drop the built-ins and keep whatever we registered ourselves.
		return hasDelegation ? { noTools: "builtin" } : { noTools: "all" };
	}
	const names = hasDelegation && !spec.tools.includes(SUBAGENT_TOOL)
		? [...spec.tools, SUBAGENT_TOOL]
		: spec.tools;
	return { tools: names };
}
