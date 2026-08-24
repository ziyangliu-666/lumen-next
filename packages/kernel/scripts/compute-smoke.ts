/**
 * One real machine, so the provider is proved against Modal rather than against a fake.
 *
 * `test/compute.test.ts` checks the arithmetic against a clock it owns, which is the part
 * that can be wrong quietly. It cannot check the part that can be wrong loudly: whether a
 * container actually starts, whether a command's output comes back, and what a timeout
 * looks like when the provider decides to word it differently.
 *
 * It costs a few cents of real money. Run it with:
 *   node --experimental-strip-types packages/kernel/scripts/compute-smoke.ts
 */

import { modalCompute } from "../src/compute/modal.ts";

const compute = modalCompute({ label: `smoke-${Date.now()}` });
console.log(compute.describe);

const startedAt = Date.now();
const machine = await compute.open();
// Nothing has started yet, by design. The first command below pays the cold boot, which
// is why its own time reads shorter than the wait a person actually sits through.
console.log("machine claimed; it starts on the first command");

for (const command of [
	"pwd && python --version",
	"echo 'kept between commands' > note.txt",
	"cat note.txt",
	"pip install --quiet requests && python -c \"import requests; print(requests.get('https://example.com').status_code)\"",
	"exit 3",
]) {
	const result = await machine.exec(command);
	console.log(
		`$ ${command}\n  exit=${result.code} ${result.ms}ms ` +
			`out=${JSON.stringify(result.stdout.slice(0, 120))} err=${JSON.stringify(result.stderr.slice(0, 120))}`,
	);
}

// A command that outruns its limit. The agent must get its partial output and a plain
// statement that it was killed, not an exception with the output thrown away.
const slow = await machine.exec("echo starting; sleep 60; echo never", { minutes: 0.1 });
console.log(`timeout: killed=${slow.timedOut} exit=${slow.code} out=${JSON.stringify(slow.stdout)}`);

console.log(`spend so far $${machine.takeSpend().toFixed(4)}`);
const owed = await compute.close();
console.log(`closing charged $${owed.toFixed(4)} — total wall clock ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
