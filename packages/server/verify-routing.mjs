import WebSocket from "ws";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = 4174;
const SESS = "/tmp/lumen-verify/sessions";
const STATE = "/tmp/lumen-verify/state";

function rand() {
	return `verify-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function connect(key) {
	const url = key === null ? `ws://127.0.0.1:${PORT}/ws` : `ws://127.0.0.1:${PORT}/ws?s=${encodeURIComponent(key)}`;
	return new WebSocket(url);
}

function once(ws, pred, timeoutMs = 15000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timeout waiting for frame")), timeoutMs);
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
	// 1. Empty key, never spoken to: connect, wait a moment, verify nothing created.
	const emptyKey = rand();
	console.log("=== test 1: connect to a brand-new key and say nothing ===");
	const ws1 = connect(emptyKey);
	await new Promise((r) => ws1.on("open", r));
	await new Promise((r) => setTimeout(r, 800));
	console.log("directory exists?", existsSync(join(SESS, emptyKey)));
	console.log("record exists?", existsSync(join(STATE, `${emptyKey}.json`)));
	ws1.close();
	await new Promise((r) => setTimeout(r, 200));

	// 2. Landing-style socket: no ?s= at all, just ask for the list.
	console.log("=== test 2: list-only socket, no ?s= ===");
	const ws2 = connect(null);
	await new Promise((r) => ws2.on("open", r));
	const listPromise = once(ws2, (f) => f.type === "conversations.list");
	ws2.send(JSON.stringify({ type: "conversations.list" }));
	const list = await listPromise;
	console.log("list length:", list.conversations.length, "(pre-existing ones from earlier runs are fine)");
	ws2.close();

	// 3. Send `start` on a brand-new key: expect a hello, then a directory + record to exist.
	console.log("=== test 3: start a brand-new conversation ===");
	const freshKey = rand();
	const ws3 = connect(freshKey);
	await new Promise((r) => ws3.on("open", r));
	const helloPromise = once(ws3, (f) => f.type === "hello");
	ws3.send(JSON.stringify({ type: "start", text: "Reply with exactly the word hi and nothing else." }));
	const hello = await helloPromise;
	console.log("hello.rootNodeId:", hello.rootNodeId, "restored:", hello.fixed.restored);
	console.log("directory exists right after hello?", existsSync(join(SESS, freshKey)));

	// Wait for the turn to actually finish (node_close) so a save gets scheduled, then wait out
	// the debounce.
	await once(ws3, (f) => f.type === "node_update" && f.patch && f.patch.busy === false, 30000).catch(() => {});
	await new Promise((r) => setTimeout(r, 2500));
	console.log("record exists after the turn + debounce?", existsSync(join(STATE, `${freshKey}.json`)));
	ws3.close();
	await new Promise((r) => setTimeout(r, 300));

	// 4. Reconnect with the SAME key: should resume, not create a second thing, and hello
	// should carry the same rootNodeId with restored:false (still a live process, since the
	// server never restarted).
	console.log("=== test 4: reconnect to the same key (simulated refresh) ===");
	const ws4 = connect(freshKey);
	await new Promise((r) => ws4.on("open", r));
	const hello2Promise = once(ws4, (f) => f.type === "hello");
	const hello2 = await hello2Promise;
	console.log("hello2.rootNodeId:", hello2.rootNodeId, "restored:", hello2.fixed.restored, "same root as before:", hello2.rootNodeId === hello.rootNodeId);
	ws4.close();

	console.log("=== done ===");
	process.exit(0);
}

main().catch((err) => {
	console.error("FAILED:", err);
	process.exit(1);
});
