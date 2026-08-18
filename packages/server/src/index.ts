/**
 * One process, one person, one machine.
 *
 * No auth, no sandbox, no persistence. Those are not oversights: the agents here run bash
 * and write files with the operator's own permissions, so this is safe exactly as long as
 * the only person who can reach it is the person already sitting at the keyboard. It binds
 * to loopback for that reason, and that is the whole of the security model. Do not put it
 * behind a tunnel without putting a container around it first.
 *
 * A conversation owns a `Runtime`. Two browser tabs with different ids are two runs that
 * share nothing, which is isolation for free and the reason there is no scheduling here.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { AgentRegistry, Autopilot, money, Runtime, type AutopilotStop } from "@lumen/kernel";
import { WebSocketServer, type WebSocket } from "ws";
import { AGENTS } from "./agents.ts";
import type { AutoState, ClientFrame, Fixed, ServerFrame, Settings } from "./protocol.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const WEB_DIST = resolve(HERE, "../../web/dist");

const PORT = Number(process.env.LUMEN_PORT ?? 4173);
const PROVIDER = process.env.LUMEN_PROVIDER ?? "deepseek";
const MODEL_ID = process.env.LUMEN_MODEL ?? "deepseek-v4-pro";
const CWD = process.env.LUMEN_CWD ?? process.cwd();
/**
 * Set this low (a few thousand) to watch a line compact without holding a 20k-token
 * conversation first. It changes when the boundary appears, not what a boundary is.
 */
const KEEP_RECENT = process.env.LUMEN_KEEP_RECENT_TOKENS
	? Number(process.env.LUMEN_KEEP_RECENT_TOKENS)
	: undefined;
/**
 * Extensions to hand the agents, named here and nowhere else.
 *
 * `pi-web-access` is the one we ship with, because pi has no network tool of its own and
 * the parts that are easy to get wrong — article extraction, PDFs, a cap on how much text
 * comes back — are exactly what it already does. It is third-party code running with your
 * permissions; set LUMEN_EXTENSIONS="" to run without it.
 */
const EXTENSIONS = (process.env.LUMEN_EXTENSIONS ?? resolve(HERE, "../../../node_modules/pi-web-access"))
	.split(",")
	.map((path) => path.trim())
	.filter(Boolean);
/**
 * The most one conversation may spend while it is running itself.
 *
 * The only number this feature has, and it is on the money rather than on the turns because
 * money is what the person actually pays. A turn cap would be a proxy for it: turns differ
 * in cost by two orders of magnitude between a one-line answer and a fan-out of twelve
 * workers, so a turn limit either cuts cheap useful work short or waves an expensive run
 * through. $2 is small enough that the first time somebody leaves this running by accident
 * it costs them the price of a coffee.
 */
const AUTO_BUDGET = Number(process.env.LUMEN_AUTO_BUDGET ?? 2);

const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel(PROVIDER, MODEL_ID);
if (!model) {
	throw new Error(
		`model ${PROVIDER}/${MODEL_ID} is not available. Check ~/.pi/agent/auth.json, or set ` +
			"LUMEN_PROVIDER and LUMEN_MODEL to something you have credentials for.",
	);
}

/**
 * What the page shows and cannot change, worked out once.
 *
 * `getAvailable` asks pi which models the credentials actually reach, rather than listing
 * everything it knows about. A menu offering a model that cannot be run is a menu whose
 * every entry has to be tried to be believed.
 */
const AVAILABLE = await modelRuntime.getAvailable();
const FIXED: Fixed = {
	cwd: CWD,
	extensions: EXTENSIONS,
	port: PORT,
	models: AVAILABLE.map((model) => ({ id: `${model.provider}/${model.id}`, name: model.name })),
};

let runCounter = 0;

/**
 * One conversation: its own runtime, its own trace, its own lines.
 *
 * It outlives the socket. A browser refresh opens a new connection, and if the runtime
 * died with the old one the whole graph would go with it — which is untenable for a thing
 * whose claim is that the call tree *is* the record. So the socket is a view onto this,
 * attached and detached, and the conversation lives until the process does.
 *
 * That means conversations are never reclaimed. For one person on one machine that is the
 * honest trade: a reaper would eventually collect the line someone had left running on
 * purpose, and that is a worse failure than holding memory.
 */
class Conversation {
	readonly runtime: Runtime;
	/**
	 * The line holding the conversation, by id rather than by object.
	 *
	 * A handoff disposes the old line and opens another, so an object captured at startup
	 * goes stale the first time the person hands over — and `hello` would then name a window
	 * that closed, landing a reconnecting tab on a dead point.
	 */
	private leadLineId!: string;
	private autopilot!: Autopilot;
	/** How the last automatic run ended, kept so a tab that reconnects can still read it. */
	private stopped: AutopilotStop | undefined;
	/**
	 * Per conversation, not per process.
	 *
	 * Two tabs with different session keys are two runs that share nothing, so one of them
	 * turning the budget up must not spend the other's money. The environment supplies the
	 * value each new conversation starts from, and nothing writes back to it: a setting
	 * changed here lasts as long as the conversation, which is as long as it can honestly
	 * claim to, since nothing here is persisted at all.
	 */
	private settings: Settings = {
		autoBudget: AUTO_BUDGET,
		model: `${PROVIDER}/${MODEL_ID}`,
		keepRecentTokens: KEEP_RECENT ?? null,
	};
	// A plain field rather than a constructor parameter property: node's strip-only
	// TypeScript support cannot erase those, and this file is run directly.
	// A set, not one socket. Two tabs on the same conversation are two windows onto one
	// run; letting the second attach steal the stream would leave the first silently dead
	// while still looking connected.
	private readonly sockets = new Set<WebSocket>();
	/**
	 * What the person typed, by the point that received it.
	 *
	 * The trace records what agents did, so it has no event for this — and without it a
	 * reload brings back a conversation missing one side of itself.
	 */
	private readonly said = new Map<string, string[]>();

	constructor() {
		runCounter += 1;
		this.runtime = new Runtime({
			runId: `run-${runCounter}`,
			registry: new AgentRegistry(AGENTS),
			modelRuntime,
			model,
			cwd: CWD,
			maxDepth: 3,
			compaction: KEEP_RECENT === undefined ? undefined : { keepRecentTokens: KEEP_RECENT },
			extensions: EXTENSIONS,
		});
	}

	async start(): Promise<void> {
		const root = await this.runtime.openRoot(this.runtime.registry.get("lead"), "");
		this.leadLineId = root.id;
		this.autopilot = new Autopilot({
			host: this.runtime,
			lineId: root.id,
			budget: this.settings.autoBudget,
			onTurn: () => this.send({ type: "auto", state: this.autoState() }),
			onStop: (stop) => {
				this.stopped = stop;
				this.send({ type: "auto", state: this.autoState() });
				this.send({ type: "notice", message: describeStop(stop, this.settings.autoBudget) });
			},
		});
		// Subscribed once, for the life of the conversation. Events go to whichever socket
		// is attached, or nowhere while none is.
		this.runtime.trace.subscribe((event) => this.send(event));
	}

	private autoState(): AutoState {
		return {
			on: this.autopilot.running,
			turns: this.autopilot.turns,
			stopped: this.stopped,
		};
	}

	/** The window the conversation is standing in now, however many times it has moved. */
	private get leadNodeId(): string {
		return this.runtime.line(this.leadLineId).currentNodeId;
	}

	/**
	 * Whether the lead has anything to carry on from.
	 *
	 * Three ways to have something, because the switch can be pressed at three moments: the
	 * person has spoken to this window, or it is already working, or it has said something
	 * that a next turn could build on. A window with none of the three is empty, and the
	 * driver has nothing to drive.
	 */
	private hasSomethingToDo(): boolean {
		const node = this.runtime.trace.node(this.leadNodeId);
		return (
			(this.said.get(node.id)?.length ?? 0) > 0 ||
			node.steps.length > 0 ||
			(node.summary ?? "").trim().length > 0
		);
	}

	/** Point this conversation at a socket and bring it up to date. */
	attach(socket: WebSocket): void {
		this.sockets.add(socket);
		this.sendTo(socket, {
			type: "hello",
			agents: this.runtime.registry.list(),
			snapshot: this.runtime.trace.snapshot(),
			rootNodeId: this.leadNodeId,
			said: Object.fromEntries(this.said),
			auto: this.autoState(),
			settings: this.settings,
			fixed: FIXED,
		});
	}

	detach(socket: WebSocket): void {
		this.sockets.delete(socket);
	}

	private remember(nodeId: string, text: string): void {
		this.said.set(nodeId, [...(this.said.get(nodeId) ?? []), text]);
	}

	/**
	 * Replace `@n-3` with what n-3 currently says.
	 *
	 * This is the whole of "merging". A point that reads several lines is an empty window
	 * handed several summaries — no new edge, no join operation, nothing to invent. Note
	 * *currently*: a line that has worked for an hour contributes what it has concluded by
	 * now, not what it was asked at the start.
	 */
	private quote(text: string): { text: string; cited: string[] } {
		const cited: string[] = [];
		const filled = text.replace(/@(n-[a-z0-9]+)/g, (whole, id: string) => {
			const node = this.runtime.trace.snapshot().nodes[id];
			if (!node) return whole;
			cited.push(id);
			return `\n\n--- ${node.agent} (${id}) says ---\n${node.summary ?? "(nothing yet)"}\n--- end ---\n\n`;
		});
		return { text: filled, cited };
	}

	/**
	 * Take a patch, apply what it names, and tell every tab where things now stand.
	 *
	 * Each setting says for itself when it starts to matter, and two of the three cannot
	 * honestly claim "now": pi binds the model and the compaction thresholds when a session
	 * is built, and rebuilding a session to change them would throw away the window, which is
	 * the conversation. So they take effect on the next window, and the page says so.
	 */
	private applySettings(patch: Partial<Settings>): void {
		if (patch.autoBudget !== undefined) {
			const budget = Number(patch.autoBudget);
			// Checked here rather than trusted from the page. A budget of NaN compares false
			// against every spend, which is not a large cap — it is no cap at all.
			if (!Number.isFinite(budget) || budget <= 0) {
				this.send({ type: "error", message: "The budget has to be a number above zero." });
				return;
			}
			this.settings.autoBudget = budget;
			this.autopilot.setBudget(budget);
		}

		if (patch.model !== undefined && patch.model !== this.settings.model) {
			const [provider, ...rest] = patch.model.split("/");
			const model = modelRuntime.getModel(provider, rest.join("/"));
			if (!model) {
				this.send({
					type: "error",
					message: `No credentials for ${patch.model}. The models you can run are in ~/.pi/agent/auth.json.`,
				});
				return;
			}
			this.settings.model = patch.model;
			this.runtime.setModel(model);
			this.send({
				type: "notice",
				message: `Windows opened from now on use ${patch.model}. The ones already open keep the model they were built with.`,
			});
		}

		if (patch.keepRecentTokens !== undefined) {
			const keep = patch.keepRecentTokens;
			if (keep !== null && (!Number.isFinite(keep) || keep <= 0)) {
				this.send({ type: "error", message: "Keep-recent has to be a number above zero, or empty." });
				return;
			}
			this.settings.keepRecentTokens = keep;
			this.runtime.setCompaction(keep === null ? undefined : { keepRecentTokens: keep });
		}

		this.send({ type: "settings", settings: this.settings });
	}

	async handle(frame: ClientFrame): Promise<void> {
		if (frame.type === "settings") {
			this.applySettings(frame.patch);
			return;
		}

		if (frame.type === "auto") {
			if (frame.on) {
				// Nothing to carry on from. Measured, not feared: the first thing a person does
				// is press the interesting switch, and on an empty conversation that started a
				// loop against a window with nothing in it — which answers nobody, never
				// declares itself finished, and goes round again until the money runs out.
				if (!this.hasSomethingToDo()) {
					this.send({
						type: "notice",
						message:
							"Ask for something first. There is nothing in this window to carry on from, " +
							"and it would keep asking itself until the budget ran out.",
					});
					this.send({ type: "auto", state: this.autoState() });
					return;
				}
				this.stopped = undefined;
				this.autopilot.start();
			} else {
				this.autopilot.stop("you");
			}
			this.send({ type: "auto", state: this.autoState() });
			return;
		}

		if (frame.type === "abort") {
			const line = this.runtime.lineAt(frame.nodeId);
			if (!line) return;
			// Before the abort, not after. Stopping a turn while the switch is still on ends
			// one turn and the loop immediately starts another: the person presses stop and
			// watches the work they just cancelled begin again.
			if (line.id === this.leadLineId) this.autopilot.stop("you", "you pressed stop");
			await this.runtime.abort(line.id);
			// Say it. The only other evidence is a `stopped` tag on whichever children were
			// running, which on a tall run is below the fold — so a stop could look like the
			// work having quietly finished.
			this.send({
				type: "notice",
				message: "You stopped this run. Anything it had started is marked stopped.",
			});
			return;
		}

		const line = this.runtime.lineAt(frame.nodeId);
		if (!line) {
			// Every window before the newest one on a line is gone: compaction replaced it.
			// Saying so is better than silently routing the message somewhere it fits.
			this.send({
				type: "error",
				message:
					"That window has closed — its context was replaced by a summary. " +
					"Talk to the newest point on that line instead.",
			});
			return;
		}

		const { text, cited } = this.quote(frame.text);

		switch (frame.target.kind) {
			case "continue":
			case "queue":
			case "cutIn": {
				// One case, because all three say the same thing about where the sentence goes:
				// this window, which remembers everything. They differ only in what to do if a
				// turn is already running, and only the server can decide that — the browser's
				// `busy` flag crossed a network to get here and may already be wrong.
				const whenBusy = frame.target.kind === "cutIn" ? "steer" : "followUp";
				this.remember(line.currentNodeId, frame.text);
				const how = await this.runtime.deliver(line.id, text, whenBusy);
				if (how !== "turn" && frame.target.kind === "continue") {
					this.send({
						type: "notice",
						message:
							`${line.spec.name} was mid-turn, so your sentence waits until this turn ` +
							"finishes. Choose “cut in now” to reach it sooner.",
					});
				}
				// Deliberately does not start the loop. The switch is the only thing that does,
				// and a second entry point here raced it: the switch starts a loop that waits
				// for the turn in flight, and this line started another the moment that same
				// turn ended — so a run that had just declared itself finished took one more
				// turn to say so again. One owner, one loop.
				return;
			}
			case "send": {
				// A user-opened line has no tool call behind it, and `linkChild` needs a step
				// to hang from. Opening one by hand is not a workaround: it puts the person's
				// own moves on the graph beside the model's, which is the difference between
				// a record of a run and a record of what happened.
				const stepId = `you-${Date.now().toString(36)}`;
				const quoted = cited.length > 0 ? `, quoting ${cited.join(" and ")}` : "";
				this.runtime.trace.openStep(line.currentNodeId, {
					id: stepId,
					tool: "you",
					args: { agent: frame.target.agent, text },
					title: `you sent ${frame.target.agent} off${quoted}`,
				});
				const started = await this.runtime.startBranch(
					{
						agent: frame.target.agent,
						task: text,
						parentNodeId: line.currentNodeId,
						stepId,
						// From zero, unlike a model-opened branch. The depth cap exists to stop
						// an agent recursing without end; a person clicking is not that, and
						// inheriting the count would leave a line opened deep in the tree
						// unable to delegate at all.
						depth: 0,
					},
					"you",
				);
				this.runtime.trace.closeStep(
					line.currentNodeId,
					stepId,
					started.ok ? "done" : "failed",
					started.ok ? `${started.agent} is running on its own line` : started.error,
				);
				return;
			}
			case "next": {
				const outcome = await this.runtime.startNextWindow(line.id, text);
				if (!outcome.rotated) {
					this.send({
						type: "notice",
						message: `Stayed in this window — ${outcome.reason ?? "there was nothing to summarise"}.`,
					});
				}
				this.remember(line.currentNodeId, frame.text);
				await this.runtime.say(line.id, text);
				return;
			}
			case "handoff": {
				const { line: next, note, reason } = await this.runtime.handoff(
					line.id,
					frame.target.agent,
					text,
				);
				if (line.id === this.leadLineId) {
					this.leadLineId = next.id;
					this.autopilot.retarget(next.id);
					// And stopped. The agent now holding the conversation may have no way to say
					// it is finished, and driving an agent that cannot stop itself leaves the
					// money as the only thing that ends the run.
					this.autopilot.stop("you", `the line was handed to ${frame.target.agent}`);
				}
				if (note === "last reply") {
					this.send({
						type: "notice",
						message:
							`Could not summarise this window (${reason ?? "no reason given"}), so ` +
							`${frame.target.agent} was handed the last reply instead. It knows less ` +
							"than a normal handover would carry.",
					});
				}
				await this.runtime.say(next.id, text);
				return;
			}
		}
	}

	/** Only on shutdown. A socket closing is a person looking away, not a run ending. */
	close(): void {
		this.autopilot.stop("you", "the server is shutting down");
		this.runtime.closeAll("done");
	}

	private send(frame: ServerFrame): void {
		const payload = JSON.stringify(frame);
		for (const socket of this.sockets) {
			if (socket.readyState === socket.OPEN) socket.send(payload);
		}
	}

	private sendTo(socket: WebSocket, frame: ServerFrame): void {
		if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
	}
}

/**
 * Why an automatic run ended, in the words a person would use.
 *
 * The reason is most of the value of stopping. A run that simply went quiet reads as a
 * crash, and the next thing the person does is press the switch again.
 */
function describeStop(stop: AutopilotStop, budget: number): string {
	// The run's total, not the loop's share, and said as such. The loop can stop having taken
	// no turn at all — the turn the person asked for had already ended with `finish` — and
	// "$0.07 over 0 turns" reads as money spent by nothing.
	const spent =
		stop.turns === 0
			? `${money(stop.spent)} spent on this run`
			: `${stop.turns} turn${stop.turns === 1 ? "" : "s"} taken, ${money(stop.spent)} spent on this run`;
	switch (stop.reason) {
		case "declared":
			return `The lead says the work is done: ${stop.note ?? "no reason given"} (${spent}).`;
		case "budget":
			return `It spent its budget of ${money(budget)}, so it stopped and wrote up what it had (${spent}).`;
		case "you":
			return stop.note
				? `Running by itself stopped — ${stop.note} (${spent}).`
				: `You turned off running by itself (${spent}).`;
		case "failed":
			return `A turn failed, so it stopped rather than asking again: ${stop.note ?? "no reason recorded"} (${spent}).`;
	}
}

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".json": "application/json; charset=utf-8",
};

function serveStatic(request: IncomingMessage, response: ServerResponse): void {
	if (!existsSync(WEB_DIST)) {
		response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
		response.end("No built frontend. Run the Vite dev server, or build packages/web first.\n");
		return;
	}
	const requested = (request.url ?? "/").split("?")[0];
	// `normalize` collapses `..` before the join, so a crafted path cannot climb out of dist.
	const relative = normalize(requested === "/" ? "/index.html" : requested).replace(/^(\.\.[/\\])+/, "");
	const file = join(WEB_DIST, relative);
	const target = existsSync(file) && statSync(file).isFile() ? file : join(WEB_DIST, "index.html");
	response.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream" });
	createReadStream(target).pipe(response);
}

const http = createServer(serveStatic);
const sockets = new WebSocketServer({ server: http, path: "/ws" });

const conversations = new Map<string, Conversation>();

sockets.on("connection", async (socket, request) => {
	const key = new URL(request.url ?? "/", "http://x").searchParams.get("s") ?? `anon-${++runCounter}`;
	let conversation = conversations.get(key);
	if (!conversation) {
		conversation = new Conversation();
		try {
			await conversation.start();
		} catch (cause) {
			socket.send(JSON.stringify({ type: "error", message: String(cause) }));
			socket.close();
			return;
		}
		conversations.set(key, conversation);
	}
	conversation.attach(socket);

	socket.on("message", async (raw) => {
		let frame: ClientFrame;
		try {
			frame = JSON.parse(String(raw));
		} catch {
			return;
		}
		try {
			await conversation.handle(frame);
		} catch (cause) {
			// A failed turn must not take the socket down with it. The person can read the
			// reason and try something else; a dropped connection loses the whole graph.
			const message = cause instanceof Error ? cause.message : String(cause);
			socket.send(JSON.stringify({ type: "error", message }));
		}
	});

	// Detach, do not close. The runtime keeps working and the graph is still there when
	// the person comes back; a refresh must not be the same thing as ending the run.
	socket.on("close", () => conversation.detach(socket));
});

http.listen(PORT, "127.0.0.1", () => {
	const keep = KEEP_RECENT === undefined ? "pi default" : `${KEEP_RECENT} tok`;
	console.log(
		`lumen server on http://127.0.0.1:${PORT}\n` +
			`  model      ${PROVIDER}/${MODEL_ID}\n` +
			`  cwd        ${CWD}\n` +
			`  keepRecent ${keep}\n` +
			`  auto cap   ${money(AUTO_BUDGET)}\n` +
			`  extensions ${EXTENSIONS.length ? EXTENSIONS.map((p) => p.split("/").pop()).join(", ") : "none"}`,
	);
});
