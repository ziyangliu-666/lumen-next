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
 *
 * Sessions outlive the call that started them. A delegated agent that has answered is
 * still sitting there with its context, and a person can open it and keep working. That
 * costs memory for the length of a run and buys the only thing that makes a graph worth
 * drawing: you can walk into any point on it. `closeLine` and `closeAll` exist so the
 * caller can decide when a run is over; nothing here expires a line on its own, because
 * a timer would eventually kill the line someone was reading.
 */

import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
	SettingsManager,
	type ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import type { AgentRegistry, AgentSpec } from "./agents/types.ts";
import type { Line, LineSession } from "./line.ts";
import { record } from "./trace/record.ts";
import { Trace } from "./trace/trace.ts";
import type { NodeOrigin, NodeState } from "./trace/types.ts";

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
	/**
	 * Override pi's compaction thresholds.
	 *
	 * Worth exposing because of what the default does to a demo: pi keeps the most recent
	 * `keepRecentTokens` (20k by default) and summarises only what is older, so a short
	 * conversation has nothing to compact and refuses. That is right for real work and
	 * useless for showing what a compaction *is* — the boundary that makes a point a point
	 * would never appear on screen. Lower it and the same code path runs in a minute.
	 */
	compaction?: { enabled?: boolean; reserveTokens?: number; keepRecentTokens?: number };
	/**
	 * pi extensions to load by path, and only these.
	 *
	 * Auto-discovery stays off (see `createSession`), and this does not turn it back on:
	 * `noExtensions` suppresses what pi finds in the working directory while leaving what
	 * the caller names explicitly (`resource-loader.js:315`). So the property that matters
	 * is kept — the material an agent is reading cannot introduce a tool — while the
	 * operator can still hand one over deliberately.
	 *
	 * These run with the operator's full permissions. pi says so plainly of every package:
	 * extensions execute arbitrary code. Naming one here is a decision about trust, and
	 * this runtime has no container to fall back on if that decision is wrong.
	 */
	extensions?: string[];
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
	/** The line the child is still sitting on, so a person can go back and talk to it. */
	lineId: string;
}

export interface OpenLineOptions {
	spec: AgentSpec;
	task: string;
	parentNodeId: string | null;
	origin: NodeOrigin;
	depth: number;
}

let lineCounter = 0;

export class Runtime {
	readonly trace: Trace;
	readonly registry: AgentRegistry;
	readonly maxDepth: number;
	readonly maxConcurrent: number;
	/**
	 * While set, the delegation tool refuses every call.
	 *
	 * There is one turn where an agent must be able to write but not to spend: the last one,
	 * after the budget is gone. The tool list cannot be changed for it — `toolSelection`
	 * binds tools when the session is built, and rebuilding the session would throw away the
	 * window that holds everything the run learned. So the tool itself refuses, and says why,
	 * which the model can act on.
	 */
	blockDelegation = false;
	private readonly options: RuntimeOptions;
	private readonly lines = new Map<string, Line>();
	/** Lines whose agent has said its work is complete, by the reason it gave. */
	private readonly finished = new Map<string, string>();

	constructor(options: RuntimeOptions) {
		this.options = options;
		this.registry = options.registry;
		this.trace = new Trace(options.runId);
		this.maxDepth = options.maxDepth ?? 3;
		this.maxConcurrent = options.maxConcurrent ?? 4;
	}

	line(id: string): Line {
		const found = this.lines.get(id);
		if (!found) throw new Error(`unknown line: ${id}`);
		return found;
	}

	/** The line whose current window is this node, if that window is still live. */
	lineAt(nodeId: string): Line | undefined {
		for (const line of this.lines.values()) {
			if (line.currentNodeId === nodeId) return line;
		}
		return undefined;
	}

	/**
	 * Open a window and the session behind it.
	 *
	 * The node is created before the session, so a session that throws while starting
	 * still leaves a point on the graph carrying the reason. A node that only appears on
	 * success is a node that can never explain a failure.
	 */
	async openLine(options: OpenLineOptions): Promise<Line> {
		const node = this.trace.openNode({
			parentId: options.parentNodeId,
			agent: options.spec.name,
			task: options.task,
			origin: options.origin,
			depth: options.depth,
			model: options.spec.model,
		});

		lineCounter += 1;
		// Built in two steps on purpose. The delegation tool this session is about to be
		// given has to read `currentNodeId` at the moment it is called, which is long
		// after the session exists — so the object it closes over must be this one, and it
		// must exist before the session does.
		const line = {
			id: `l-${lineCounter.toString(36)}`,
			spec: options.spec,
			currentNodeId: node.id,
			depth: options.depth,
			session: undefined as unknown as LineSession,
			stop: () => {},
		} satisfies Line as Line;
		this.lines.set(line.id, line);

		try {
			line.session = (await this.createSession(options.spec, line)) as unknown as LineSession;
		} catch (cause) {
			const error = cause instanceof Error ? cause.message : String(cause);
			this.trace.closeNode(node.id, "failed", { error });
			this.lines.delete(line.id);
			throw cause;
		}

		line.stop = record(this.trace, line.session, {
			nodeId: () => line.currentNodeId,
			onCompaction: (report) => this.rotate(line, report.reason, report.summary),
		});
		return line;
	}

	/**
	 * End the current window and open its successor on the same line.
	 *
	 * The conversation did not end here; only the window did. So the agent, the line and
	 * the depth all carry over, and the summary becomes the next window's task because
	 * that is literally what the model will see first.
	 */
	private rotate(line: Line, reason: "manual" | "threshold" | "overflow", summary: string): void {
		// A handoff is using the compactor to write its farewell note. Its successor is a
		// different agent on a different line, so this line gets no next window.
		if (line.handingOff) return;
		const previous = line.currentNodeId;
		const wasBusy = this.trace.node(previous).busy;
		this.trace.closeNode(previous, "done", { summary });
		const next = this.trace.openNode({
			parentId: previous,
			agent: line.spec.name,
			task: summary,
			origin: { kind: "compact", reason },
			depth: line.depth,
			model: line.spec.model,
		});
		if (wasBusy) this.trace.updateNode(next.id, { busy: true });
		line.currentNodeId = next.id;
	}

	/**
	 * Send one message to a line and wait for it to settle.
	 *
	 * `busy` is set around the call rather than derived from events. A window that has
	 * answered and a window that is thinking are both `running`, and the interface has to
	 * put an input box on one and a spinner on the other.
	 */
	async say(lineId: string, text: string, signal?: AbortSignal): Promise<void> {
		const line = this.line(lineId);
		this.trace.updateNode(line.currentNodeId, { busy: true });
		const onAbort = () => void line.session.abort();
		signal?.addEventListener("abort", onAbort, { once: true });
		try {
			await line.session.prompt(text);
		} finally {
			signal?.removeEventListener("abort", onAbort);
			// Read `currentNodeId` again: the turn may have compacted, in which case the
			// window that started busy no longer exists and the flag belongs to its heir.
			this.trace.updateNode(line.currentNodeId, { busy: false });
		}
	}

	/**
	 * Put a sentence into a turn that is already running.
	 *
	 * Not a turn of its own, so `busy` is untouched: the window was working before this
	 * arrived and is working after, and flipping the flag would make the interface start a
	 * fresh block of streaming text in the middle of one.
	 *
	 *   steer      reaches the model at its next step. Subagents already running are left
	 *              alone, which is why this is the right "interrupt": aborting would throw
	 *              away work that has already been paid for.
	 *   followUp   waits until the turn has run out of work of its own.
	 *
	 * The caller has to have decided that a turn is running. `prompt` refuses while the
	 * session streams and these two refuse when it does not, so the choice between them is
	 * made from `session.isStreaming` at the moment the sentence arrives.
	 */
	async interject(lineId: string, text: string, how: "steer" | "followUp"): Promise<void> {
		const line = this.line(lineId);
		if (how === "steer") await line.session.steer(text);
		else await line.session.followUp(text);
	}

	/** Resolve once this line has no turn in flight. */
	async settle(lineId: string): Promise<void> {
		await this.line(lineId).session.waitForIdle();
	}

	/** Whether a turn is running on this line, as pi sees it rather than as the trace does. */
	isStreaming(lineId: string): boolean {
		return this.line(lineId).session.isStreaming;
	}

	/**
	 * Record that this line's agent says the work is complete.
	 *
	 * Written by the `finish` tool and read by whoever is driving the line. Kept here rather
	 * than on the node, because it is not something the agent did — the trace records tool
	 * calls and windows — it is a message to the driver about whether to ask again.
	 */
	declareFinish(lineId: string, reason: string): void {
		this.finished.set(lineId, reason);
	}

	/**
	 * Read the declaration once and clear it.
	 *
	 * Read-and-clear rather than a plain getter. A declaration left standing would stop the
	 * next automatic run on its first turn, and the person would see a run that ended
	 * instantly for a reason given hours ago.
	 */
	takeFinish(lineId: string): string | undefined {
		const reason = this.finished.get(lineId);
		this.finished.delete(lineId);
		return reason;
	}

	/**
	 * Run one agent on one task and return what it said.
	 *
	 * The line stays open afterwards. The parent has its answer, but the child is still a
	 * live window a person can walk into and question further, which is the difference
	 * between a picture of a run and a place to work.
	 */
	async spawn(request: SpawnRequest, signal?: AbortSignal): Promise<SpawnResult> {
		const spec = this.registry.get(request.agent);

		if (request.depth > this.maxDepth) {
			// Still drawn, and drawn as failed. A refusal the parent can read is worth a
			// point on the graph; a refusal that leaves no trace looks like an agent that
			// simply chose not to delegate.
			const node = this.trace.openNode({
				parentId: request.parentNodeId,
				agent: spec.name,
				task: request.task,
				origin: { kind: "delegate", stepId: request.stepId },
				depth: request.depth,
				model: spec.model,
			});
			this.trace.linkChild(request.parentNodeId, request.stepId, node.id);
			const error = `delegation depth ${request.depth} exceeds the limit of ${this.maxDepth}`;
			this.trace.closeNode(node.id, "failed", { error });
			return { nodeId: node.id, lineId: "", agent: spec.name, ok: false, output: "", error };
		}

		let line: Line;
		try {
			line = await this.openLine({
				spec,
				task: request.task,
				parentNodeId: request.parentNodeId,
				origin: { kind: "delegate", stepId: request.stepId },
				depth: request.depth,
			});
		} catch (cause) {
			const error = cause instanceof Error ? cause.message : String(cause);
			return { nodeId: "", lineId: "", agent: spec.name, ok: false, output: "", error };
		}

		this.trace.linkChild(request.parentNodeId, request.stepId, line.currentNodeId);

		try {
			await this.say(line.id, request.task, signal);
			const output = this.trace.node(line.currentNodeId).summary ?? "";
			const aborted = signal?.aborted === true;
			if (aborted) this.trace.closeNode(line.currentNodeId, "aborted", { summary: output });
			return {
				nodeId: line.currentNodeId,
				lineId: line.id,
				agent: spec.name,
				ok: !aborted,
				output,
			};
		} catch (cause) {
			const error = cause instanceof Error ? cause.message : String(cause);
			this.trace.closeNode(line.currentNodeId, "failed", { error });
			return {
				nodeId: line.currentNodeId,
				lineId: line.id,
				agent: spec.name,
				ok: false,
				output: "",
				error,
			};
		}
	}

	/**
	 * Start a line that nobody is waiting for.
	 *
	 * The same machinery as `spawn`, minus the await — and that one difference changes
	 * everything downstream. A delegate is part of its caller's turn: the caller blocks,
	 * reads the answer, and dies together with it. A branch is a conversation of its own
	 * from the first token. It outlives the turn that opened it, compacts on its own, and
	 * is still there to be talked to when its opener has moved on.
	 *
	 * Why this has to exist: blocking delegation freezes the whole conversation for as long
	 * as the child runs. That is fine for a lookup and useless for work that takes twenty
	 * minutes — during which the person can neither talk to the parent, which is stuck
	 * inside a tool call, nor to the child, which has not been given a way to be reached.
	 *
	 * The parent's `AbortSignal` is deliberately not passed on. Stopping the turn that
	 * opened a branch must not stop the branch; that is the difference between changing your
	 * mind about a question and cancelling work you set going on purpose.
	 */
	async startBranch(
		request: SpawnRequest,
		by: "model" | "you" = "model",
	): Promise<SpawnResult> {
		const spec = this.registry.get(request.agent);
		const origin = { kind: "branch", stepId: request.stepId, by } as const;

		if (request.depth > this.maxDepth) {
			// The same cap as delegation, and for a sharper reason. If branching reset the
			// count, an agent stopped at the limit could open a branch, start again from
			// zero, and recurse without end — with nothing waiting on any of it to notice.
			const node = this.trace.openNode({
				parentId: request.parentNodeId,
				agent: spec.name,
				task: request.task,
				origin,
				depth: request.depth,
				model: spec.model,
			});
			this.trace.linkChild(request.parentNodeId, request.stepId, node.id);
			const error = `branch depth ${request.depth} exceeds the limit of ${this.maxDepth}`;
			this.trace.closeNode(node.id, "failed", { error });
			return { nodeId: node.id, lineId: "", agent: spec.name, ok: false, output: "", error };
		}

		const line = await this.openLine({
			spec,
			task: request.task,
			parentNodeId: request.parentNodeId,
			origin,
			depth: request.depth,
		});
		this.trace.linkChild(request.parentNodeId, request.stepId, line.currentNodeId);

		// Deliberately not awaited. The catch is not tidiness: nothing else will ever look
		// at this promise, so without it a branch that throws would reject into nowhere and
		// sit on the graph as `running` for the rest of the session.
		void this.say(line.id, request.task).catch((cause) => {
			const error = cause instanceof Error ? cause.message : String(cause);
			this.trace.closeNode(line.currentNodeId, "failed", { error });
		});

		return {
			nodeId: line.currentNodeId,
			lineId: line.id,
			agent: spec.name,
			ok: true,
			output: "",
		};
	}

	/** Open the run's own top-level line. Its first window is the root of the trace. */
	async openRoot(spec: AgentSpec, task: string): Promise<Line> {
		return this.openLine({ spec, task, parentNodeId: null, origin: { kind: "root" }, depth: 0 });
	}

	/**
	 * End this window deliberately and start the next one on the same line.
	 *
	 * Same agent, same conversation, smaller window. `instructions` is what the person is
	 * about to ask for; it steers what the summary keeps. Note the limit: pi appends it to
	 * the summariser's prompt as `Additional focus`, so it tilts the summary rather than
	 * dictating it. Do not tell the user their summary was written to order.
	 */
	async startNextWindow(
		lineId: string,
		instructions?: string,
	): Promise<{ rotated: boolean; reason?: string }> {
		try {
			// The `compaction_end` event does the rest: `rotate` closes this window and opens
			// its successor, so by the time this returns `currentNodeId` has already moved.
			await this.line(lineId).session.compact(instructions);
			return { rotated: true };
		} catch (cause) {
			// pi refuses to summarise a conversation with nothing in it yet, and says so
			// with a plain Error. Rather than matching its wording — which would rot on the
			// next version — treat every refusal the same way: there is no summary, so
			// there is no new window, so stay in this one. The caller says so out loud.
			// Carrying on in the same window is what the person wanted anyway; a window
			// with nothing in it has no weight to shed.
			return { rotated: false, reason: cause instanceof Error ? cause.message : String(cause) };
		}
	}

	/**
	 * Move the conversation to a different agent.
	 *
	 * The successor gets the summary and nothing else, and that is not a shortcut: verbatim
	 * history is full of tool calls naming the previous agent's tools, and an agent reading
	 * its own past doing things it cannot do behaves unpredictably. A summary is prose, so
	 * it crosses. This is why handing over has to go through the summariser at all.
	 *
	 * Depth does not change. The conversation continued; it did not go a level deeper.
	 */
	async handoff(
		lineId: string,
		agentName: string,
		instructions?: string,
	): Promise<{ line: Line; note: "summary" | "last reply"; reason?: string }> {
		const line = this.line(lineId);
		const spec = this.registry.get(agentName);
		const from = line.currentNodeId;

		line.handingOff = true;
		let summary: string;
		let note: "summary" | "last reply" = "summary";
		let reason: string | undefined;
		try {
			const result = await line.session.compact(instructions);
			summary = result.summary;
		} catch (cause) {
			// The summariser would not run. Unlike `startNextWindow` this cannot simply stay
			// put: the person asked for a different agent, and refusing would leave them
			// with the wrong one. Hand over what the outgoing agent last said instead.
			//
			// Carry the real reason out. An earlier version named the most likely cause
			// ("there was not enough to summarise") for every failure, and it was wrong in
			// the field — the message appeared on a full 19k-token window, where that cannot
			// have been it. Guessing a cause is worse than reporting none: the person stops
			// looking, and so does whoever reads the report.
			reason = cause instanceof Error ? cause.message : String(cause);
			summary = this.trace.node(from).summary ?? "";
			note = "last reply";
		} finally {
			line.handingOff = false;
		}
		if (!summary.trim()) {
			summary = `Taking over from ${line.spec.name}, which had not said anything yet.`;
		}

		this.trace.closeNode(from, "done", { summary });
		// The old line is finished, but its window is already closed with the right state,
		// so tear it down without letting `closeLine` close the node a second time.
		line.stop();
		line.session.dispose();
		this.lines.delete(line.id);

		const next = await this.openLine({
			spec,
			task: summary,
			parentNodeId: from,
			origin: { kind: "handoff", from: line.spec.name },
			depth: line.depth,
		});
		return { line: next, note, reason };
	}

	async abort(lineId: string): Promise<void> {
		// Safe on an idle session: pi's abort waits for idle and no-ops when already there.
		await this.line(lineId).session.abort();
	}

	/** Stop recording, close the live window, and dispose the session. */
	closeLine(lineId: string, state: NodeState = "done"): void {
		const line = this.lines.get(lineId);
		if (!line) return;
		line.stop();
		this.trace.closeNode(line.currentNodeId, state);
		line.session.dispose();
		this.lines.delete(lineId);
	}

	closeAll(state: NodeState = "done"): void {
		for (const id of [...this.lines.keys()]) this.closeLine(id, state);
	}

	private async createSession(spec: AgentSpec, line: Line) {
		// Imported here rather than at the top because the tools need the runtime, and a
		// top-level import would make runtime.ts and these a cycle.
		const { createSubagentTool } = await import("./tools/subagent.ts");
		const { createFinishTool } = await import("./tools/finish.ts");
		const customTools = [
			...(spec.canDelegate ? [createSubagentTool({ runtime: this, line })] : []),
			...(spec.canFinish ? [createFinishTool({ runtime: this, line })] : []),
		];

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
			// Named by the operator, never discovered. An agent still cannot gain a tool by
			// reading a repository that offers one.
			additionalExtensionPaths: this.options.extensions ?? [],
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
			// Only when asked. Left unset, pi reads the operator's own settings file, which
			// is what they expect their thresholds to mean.
			...(this.options.compaction
				? { settingsManager: SettingsManager.inMemory({ compaction: this.options.compaction }) }
				: {}),
			...toolSelection(spec, customTools.map((tool) => tool.name)),
			customTools,
		});
		return session;
	}
}

/** The tool name the delegation tool registers under. Kept here so the allowlist can name it. */
export const SUBAGENT_TOOL = "subagent";
/** Likewise for the tool an agent uses to say its work is complete. */
export const FINISH_TOOL = "finish";

/**
 * Turn a spec's tool list into pi's own options.
 *
 * pi reads `tools` as "enable exactly these", not as "restrict the built-ins". So an
 * empty list does not mean "no file tools, keep my custom ones" — it means no tools at
 * all, including the delegation tool. A lead agent configured that way still tries to
 * delegate: it writes the tool call out as plain text, the text goes nowhere, and the
 * run looks like it worked. That is measured, not feared; it is what the first real run
 * of this code did.
 *
 * `custom` is the names of the tools built for this agent, and every one of them has to be
 * listed. Taking a boolean here was enough while there was one such tool and became a trap
 * the moment there were two: the second would be handed to pi in `customTools`, left out of
 * the allowlist, and dropped without a word.
 */
export function toolSelection(
	spec: AgentSpec,
	custom: string[],
): { tools?: string[]; noTools?: "all" | "builtin" } {
	if (spec.tools === undefined) return {};
	if (spec.tools.length === 0) {
		// Name the tools that survive, rather than asking for the built-ins to be dropped.
		// `noTools: "builtin"` removes exactly the built-ins and leaves everything else
		// standing — including any tool a loaded extension registered. That was measured,
		// not feared: with `pi-web-access` loaded, a lead declared as having no tools at all
		// fetched two web pages when asked to.
		//
		// An allowlist that holds only until someone installs an extension is not an
		// allowlist. `tools` means "enable exactly these", so it is the only form that says
		// what we mean.
		return custom.length > 0 ? { tools: [...custom] } : { noTools: "all" };
	}
	const missing = custom.filter((name) => !spec.tools?.includes(name));
	return { tools: [...spec.tools, ...missing] };
}
