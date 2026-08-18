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
import { AgentRegistry, Runtime, type Line } from "@lumen/kernel";
import { WebSocketServer, type WebSocket } from "ws";
import { AGENTS } from "./agents.ts";
import type { ClientFrame, ServerFrame } from "./protocol.ts";

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

const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel(PROVIDER, MODEL_ID);
if (!model) {
	throw new Error(
		`model ${PROVIDER}/${MODEL_ID} is not available. Check ~/.pi/agent/auth.json, or set ` +
			"LUMEN_PROVIDER and LUMEN_MODEL to something you have credentials for.",
	);
}

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
	private root!: Line;
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
		this.root = await this.runtime.openRoot(this.runtime.registry.get("lead"), "");
		// Subscribed once, for the life of the conversation. Events go to whichever socket
		// is attached, or nowhere while none is.
		this.runtime.trace.subscribe((event) => this.send(event));
	}

	/** Point this conversation at a socket and bring it up to date. */
	attach(socket: WebSocket): void {
		this.sockets.add(socket);
		this.sendTo(socket, {
			type: "hello",
			agents: this.runtime.registry.list(),
			snapshot: this.runtime.trace.snapshot(),
			rootNodeId: this.root.currentNodeId,
			said: Object.fromEntries(this.said),
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

	async handle(frame: ClientFrame): Promise<void> {
		if (frame.type === "abort") {
			const line = this.runtime.lineAt(frame.nodeId);
			if (!line) return;
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
				this.remember(line.currentNodeId, frame.text);
				await this.runtime.say(line.id, text);
				return;
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
			`  extensions ${EXTENSIONS.length ? EXTENSIONS.map((p) => p.split("/").pop()).join(", ") : "none"}`,
	);
});
