import WebSocket from "ws";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = 4174;
const SESS = "/tmp/lumen-verify/sessions";

function rand() {
	return `race-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
function connect(key) {
	return new WebSocket(`ws://127.0.0.1:${PORT}/ws?s=${encodeURIComponent(key)}`);
}
function once(ws, pred, timeoutMs = 15000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
		ws.on("message", (raw) => {
			const frame = JSON.parse(String(raw));
			if (pred(frame)) {
				clearTimeout(timer);
				resolve(frame);
			}
		});
	});
}

async function main() {
	const key = rand();
	const wsA = connect(key);
	const wsB = connect(key);
	await Promise.all([new Promise((r) => wsA.on("open", r)), new Promise((r) => wsB.on("open", r))]);
	const helloA = once(wsA, (f) => f.type === "hello");
	const helloB = once(wsB, (f) => f.type === "hello");
	// Both fire "start" back-to-back, before either could possibly have seen a hello.
	wsA.send(JSON.stringify({ type: "start", text: "message A" }));
	wsB.send(JSON.stringify({ type: "start", text: "message B" }));
	const [a, b] = await Promise.all([helloA, helloB]);
	console.log("both got hello, same root:", a.rootNodeId === b.rootNodeId, a.rootNodeId, b.rootNodeId);
	console.log("directory created once:", existsSync(join(SESS, key)));
	// Both "you" turns should show up as steps eventually (racy but generous timeout).
	await new Promise((r) => setTimeout(r, 2000));
	wsA.close();
	wsB.close();
	console.log("done");
	process.exit(0);
}
main().catch((e) => {
	console.error("FAILED", e);
	process.exit(1);
});
