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
import type { Compute, Machine } from "./compute/types.ts";
import { IdeaGraph } from "./ideas.ts";
import type { Line, LineSession } from "./line.ts";
import { record } from "./trace/record.ts";
import { Trace } from "./trace/trace.ts";
import { money } from "./trace/types.ts";
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
	/**
	 * Where an agent's commands run, if anywhere.
	 *
	 * Absent by default, and absent is a working configuration rather than a broken one:
	 * lumen without it is what it has always been, a system that reads and reports. An
	 * agent given `canRun` with no compute here is told plainly that it has no machine,
	 * which it can act on, instead of meeting a crash.
	 */
	compute?: Compute;
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
	readonly ideas: IdeaGraph;
	readonly registry: AgentRegistry;
	/**
	 * How deep delegation may go, and how many children one call may run at once.
	 *
	 * Both are read at the moment they are needed — the depth when a window is asked for, the
	 * concurrency when a fan-out starts — so changing either applies to work started from now
	 * on and disturbs nothing already running. Neither is a spending limit: raising the depth
	 * multiplies the tree, and the budget is the only thing that bounds what that costs.
	 */
	maxDepth: number;
	maxConcurrent: number;
	/**
	 * The most this run may spend, in dollars, before it stops opening windows. Unset means
	 * no cap.
	 *
	 * Set by whoever is driving the run, and only while they are driving it. A cap that
	 * stayed on would eventually stop a person's own delegations working, hours after the
	 * automatic run it was meant for had finished.
	 *
	 * It is checked in three places for three different time scales, and all three are
	 * needed. The driver checks between turns, so a loop never starts a turn it cannot pay
	 * for. The delegation tool checks when a fan-out arrives, so one turn cannot spend the
	 * cap twenty times over. `spawn` checks per window, so a twenty-entry array that trips
	 * the cap at entry five leaves the rest as readable failed points instead of running to
	 * completion.
	 *
	 * It is also what makes the last turn of a spent run work. The tool list is bound when
	 * the session is built, so the delegation tool cannot be taken away from a line already
	 * running; instead the tool stays and refuses, in words the model can act on.
	 */
	spendCap: number | undefined;
	/**
	 * Where the agents are standing, appended to every system prompt from the next window on.
	 *
	 * A conversation has a directory of its own now, and it may have been pointed at material
	 * to study. Neither is something an agent can work out for itself: its tools resolve
	 * relative paths against a directory nothing tells it the name of, and material outside
	 * that directory can only be reached by an absolute path it has never been given.
	 *
	 * Held here and not in the specs because it changes per conversation and per setting,
	 * while a spec is what an agent *is*. Read when a session is built, so it reaches the next
	 * window and leaves the ones already open alone — the same promise the model setting makes,
	 * and for the same reason.
	 */
	place: string | undefined;
	/**
	 * What new lines are built with. Held apart from the options they came from, because
	 * these two can be changed while the run is going and the rest cannot.
	 *
	 * A line already open keeps the model and the thresholds it was built with. pi binds both
	 * when the session is created, and rebuilding a session to change them would throw away
	 * the window — which is the conversation. So the honest promise is "from the next window
	 * onwards", and the interface says exactly that rather than implying more.
	 */
	private model: RuntimeOptions["model"];
	private compaction: RuntimeOptions["compaction"];
	private readonly options: RuntimeOptions;
	private readonly lines = new Map<string, Line>();
	/** Lines whose agent has said its work is complete, by the reason it gave. */
	private readonly finished = new Map<string, string>();

	constructor(options: RuntimeOptions) {
		this.options = options;
		this.registry = options.registry;
		this.trace = new Trace(options.runId);
		this.ideas = new IdeaGraph(options.runId);
		this.maxDepth = options.maxDepth ?? 3;
		this.maxConcurrent = options.maxConcurrent ?? 4;
		this.model = options.model;
		this.compaction = options.compaction;
	}

	/** The model the next window will open with. Windows already open keep theirs. */
	setModel(model: RuntimeOptions["model"]): void {
		this.model = model;
	}

	/** The compaction thresholds the next window will open with. */
	setCompaction(compaction: RuntimeOptions["compaction"]): void {
		this.compaction = compaction;
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
		if (wasBusy) this.trace.setBusy(next.id, true);
		line.currentNodeId = next.id;
	}

	/**
	 * Send one message to a line and wait for it to settle.
	 *
	 * `busy` on the node is set around the call rather than derived from events. A window
	 * that has answered and a window that is thinking are both `running`, and the interface
	 * has to put an input box on one and a spinner on the other.
	 *
	 * Refuses when a turn is already running rather than queueing behind it. Two turns over
	 * one message history is not a longer conversation, it is two agents writing into the
	 * same window; `deliver` is the one place that decides which of the two things a
	 * sentence should do.
	 */
	say(lineId: string, text: string, signal?: AbortSignal): Promise<void> {
		const line = this.line(lineId);
		if (line.inFlight) {
			return Promise.reject(
				new Error(`line ${lineId} is already running a turn; use deliver(), which joins it`),
			);
		}
		// A new turn supersedes any earlier declaration. Without this, a line that said it was
		// finished an hour ago would stop the next automatic run before its first turn, and
		// the person would be shown a reason given long before the question they just asked.
		this.finished.delete(line.id);
		// Latched before the turn is started, and released by the turn itself. A latch set
		// after the work begins is a latch the next caller can slip past, which is exactly
		// how pi's own `isStreaming` fails us here.
		let released!: () => void;
		line.inFlight = new Promise<void>((resolve) => {
			released = resolve;
		});
		return this.runTurn(line, text, signal).finally(() => {
			line.inFlight = undefined;
			released();
		});
	}

	private async runTurn(line: Line, text: string, signal?: AbortSignal): Promise<void> {
		this.trace.setBusy(line.currentNodeId, true);
		const onAbort = () => void line.session.abort();
		signal?.addEventListener("abort", onAbort, { once: true });
		try {
			await line.session.prompt(text);
		} finally {
			signal?.removeEventListener("abort", onAbort);
			// Read `currentNodeId` again: the turn may have compacted, in which case the
			// window that started busy no longer exists and the clock belongs to its heir.
			this.trace.setBusy(line.currentNodeId, false);
		}
	}

	/**
	 * Send a sentence to a line whatever state it is in, and say which way it went.
	 *
	 * The caller cannot make this choice for itself. Between asking "is a turn running?" and
	 * acting on the answer, a caller that awaits anything has already lost the race: pi
	 * throws on `prompt` during a turn, and queues into nowhere when there is none. Here the
	 * latch is read and acted on with nothing awaited in between, which is what makes the
	 * decision atomic on a single thread.
	 *
	 * It returns which of the three happened because they read differently to a person, and
	 * the interface has to say. A sentence that joined a turn and a sentence that started one
	 * both leave the point spinning.
	 */
	async deliver(
		lineId: string,
		text: string,
		whenBusy: "steer" | "followUp",
		signal?: AbortSignal,
	): Promise<"turn" | "steer" | "followUp"> {
		const line = this.line(lineId);
		if (!line.inFlight) {
			await this.say(lineId, text, signal);
			return "turn";
		}
		await this.interject(lineId, text, whenBusy);
		return whenBusy;
	}

	/**
	 * Put a sentence into a turn that is already running.
	 *
	 * Not a turn of its own, so `busy` is untouched: the window was working before this
	 * arrived and is working after. Flipping the flag here would clear it when this returns,
	 * a moment later, while the agent is still working — and the point would draw itself
	 * idle, with an input box, in the middle of a turn.
	 *
	 *   steer      reaches the model at its next step. Subagents already running are left
	 *              alone, which is why this is the right "interrupt": aborting would throw
	 *              away work that has already been paid for.
	 *   followUp   waits until the turn has run out of work of its own.
	 */
	async interject(lineId: string, text: string, how: "steer" | "followUp"): Promise<void> {
		const line = this.line(lineId);
		if (how === "steer") await line.session.steer(text);
		else await line.session.followUp(text);
	}

	/** Resolve once this line has no turn in flight. */
	async settle(lineId: string): Promise<void> {
		await this.line(lineId).inFlight;
	}

	/** Everything this run has spent, in dollars. Every window's own figure, added once. */
	totalCost(): number {
		return this.trace.totalCost();
	}

	/** What the run has spent and what it may spend, so every refusal quotes the same pair. */
	budget(): { spent: number; cap: number } {
		return { spent: this.totalCost(), cap: this.spendCap ?? Infinity };
	}

	/** Whether the run has spent everything it was allowed to. */
	overspent(): boolean {
		return this.spendCap !== undefined && this.totalCost() >= this.spendCap;
	}

	/**
	 * This conversation's machine, opened on first use.
	 *
	 * Opened here rather than when the conversation starts, because opening one costs
	 * money from the second it exists. A conversation that turns out to be a question
	 * about a paper should not be billed for a container nothing ever ran a command on.
	 *
	 * Null when no provider was configured. The caller says so to the agent; it is not an
	 * error, it is a smaller system.
	 */
	async machine(): Promise<Machine | null> {
		if (!this.options.compute) return null;
		return await this.options.compute.open();
	}

	/**
	 * Shut the machine down and hand back the last seconds it ran up.
	 *
	 * Those seconds belong to nobody in particular — they are the gap between the last
	 * command and the conversation ending — so the caller charges them to the root, which
	 * is the one window that is always there.
	 */
	async closeCompute(): Promise<number> {
		if (!this.options.compute) return 0;
		return await this.options.compute.close();
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
	 * Look at the declaration without clearing it.
	 *
	 * For a caller that has to decide whether to start driving at all — starting only to stop
	 * on the very first check reads, to a person watching the switch, as the switch failing.
	 * Seeing it first and not starting is silent by comparison. `takeFinish` stays the one
	 * place the declaration is actually consumed, so a real turn still supersedes it exactly
	 * as before.
	 */
	peekFinish(lineId: string): string | undefined {
		return this.finished.get(lineId);
	}

	/** The refusal every spend-related message quotes, so they cannot disagree with each other. */
	overspentMessage(): string {
		const { spent, cap } = this.budget();
		return `this run has spent ${money(spent)} of its ${money(cap)} cap; no more agents can be started`;
	}

	/**
	 * Turn down a request for a window, and draw the refusal.
	 *
	 * Still a point on the graph, and drawn as failed. A refusal the parent can read is
	 * worth a point; a refusal that leaves no trace looks exactly like an agent that simply
	 * chose not to delegate, and the person is left wondering why nothing happened.
	 */
	private refuse(
		request: SpawnRequest,
		spec: AgentSpec,
		error: string,
		origin: NodeOrigin,
	): SpawnResult {
		const node = this.trace.openNode({
			parentId: request.parentNodeId,
			agent: spec.name,
			task: request.task,
			origin,
			depth: request.depth,
			model: spec.model,
		});
		this.trace.linkChild(request.parentNodeId, request.stepId, node.id);
		this.trace.closeNode(node.id, "failed", { error });
		return { nodeId: node.id, lineId: "", agent: spec.name, ok: false, output: "", error };
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

		// Per window, not per call. One `tasks` array can hold twenty entries, and the cap
		// being reached at entry five must leave the other fifteen as points a person can
		// read rather than fifteen windows that ran anyway.
		if (this.overspent()) {
			return this.refuse(request, spec, this.overspentMessage(), { kind: "delegate", stepId: request.stepId });
		}

		if (request.depth > this.maxDepth) {
			return this.refuse(
				request,
				spec,
				`delegation depth ${request.depth} exceeds the limit of ${this.maxDepth}`,
				{ kind: "delegate", stepId: request.stepId },
			);
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

		if (this.overspent()) {
			return this.refuse(request, spec, this.overspentMessage(), origin);
		}

		if (request.depth > this.maxDepth) {
			// The same cap as delegation, and for a sharper reason. If branching reset the
			// count, an agent stopped at the limit could open a branch, start again from
			// zero, and recurse without end — with nothing waiting on any of it to notice.
			return this.refuse(
				request,
				spec,
				`branch depth ${request.depth} exceeds the limit of ${this.maxDepth}`,
				origin,
			);
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
		const { createSaveTool } = await import("./tools/save.ts");
		const { createRunTool } = await import("./tools/run.ts");
		const { createCollectTool } = await import("./tools/collect.ts");
		const { createDiscoverTool } = await import("./tools/discover.ts");

		const cwd = this.options.cwd ?? process.cwd();
		const customTools = [
			...(spec.canDelegate ? [createSubagentTool({ runtime: this, line })] : []),
			...(spec.canFinish ? [createFinishTool({ runtime: this, line })] : []),
			// Rooted at the working directory, which is this conversation's own. The tool
			// resolves paths itself rather than trusting pi's resolver, which lets an absolute
			// path out of the directory entirely.
			...(spec.canSave ? [createSaveTool({ root: cwd })] : []),
			// Given whether or not a provider is configured. The tool itself says "there is
			// no machine" and the agent carries on reading; taking the tool away instead
			// would leave the model calling a name that does not exist, which pi returns as
			// an error with nothing in it a model can act on.
			...(spec.canRun ? [createRunTool({ runtime: this, line })] : []),
			// Both permissions, not a third flag of its own: an agent that cannot run has
			// nothing on a machine worth collecting, and one that cannot save has nowhere to
			// put it. `collect` is strictly narrower than the two capabilities it composes,
			// so gating it on a scarce permission neither of them already is would be asking
			// the operator to hand out a name for "both of the other two."
			...(spec.canRun && spec.canSave ? [createCollectTool({ runtime: this, line, root: cwd })] : []),
			...(spec.canDiscover ? [createDiscoverTool({ runtime: this, line })] : []),
		];
		// Extensions, skills and context files are all discovered from the working
		// directory, and the working directory is full of the user's own material. An
		// agent that loads configuration from there is an agent whose instructions the
		// content it is reading can rewrite. The system prompt comes from the spec and
		// from nowhere else.
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			agentDir: getAgentDir(),
			// The spec says what this agent is; `place` says where it is standing. Joined here
			// rather than baked into the spec, because one is fixed and the other moves.
			systemPrompt: this.place ? `${spec.systemPrompt}\n\n${this.place}` : spec.systemPrompt,
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
			model: this.model,
			modelRuntime: this.options.modelRuntime,
			resourceLoader,
			// In memory: a subagent's transcript belongs to this run's trace, not to a
			// separate session file the user would have to find and correlate by hand.
			// That is still true, and still means pi's own per-session JSONL stays off —
			// the actual context window this builds dies with the process either way, and
			// a raw session file on disk would only be a second, harder-to-read copy of
			// work the trace already describes. It does not mean nothing here survives the
			// process: `Trace.snapshot()` and `IdeaGraph.snapshot()` are already the
			// correlated record — keyed by point, not by a filename someone has to guess —
			// and the server persists exactly those, debounced, to `persist.ts`. See that
			// file and `endInterruptedNodes` for what a saved run honestly claims once this
			// session, and every other one on the run, is gone.
			sessionManager: SessionManager.inMemory(),
			// Only when asked. Left unset, pi reads the operator's own settings file, which
			// is what they expect their thresholds to mean.
			...(this.compaction
				? { settingsManager: SettingsManager.inMemory({ compaction: this.compaction }) }
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
