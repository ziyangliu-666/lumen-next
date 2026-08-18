/**
 * The one tool that writes, checked against a real directory.
 *
 * Everything here is about the boundary rather than about writing files. The tool exists
 * because pi's own `write` resolves an absolute path away from its working directory, so the
 * tests that matter are the ones that try to leave the root, and each of them checks that
 * nothing arrived outside it.
 */

import { afterAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createSaveTool } from "../src/tools/save.ts";

const made: string[] = [];

/** A fresh directory per test, so one test's files cannot answer another test's question. */
function tempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-save-"));
	made.push(dir);
	return dir;
}

afterAll(() => {
	for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function textOf(result: any): string {
	return result.content.map((part: any) => part.text).join("");
}

describe("save", () => {
	it("writes the file and reports where it went, relative to the root", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		const result = await tool.execute("t1", { path: "findings.md", text: "the answer is 3" });

		expect(result.isError).toBeUndefined();
		expect(fs.readFileSync(path.join(root, "findings.md"), "utf8")).toBe("the answer is 3");
		expect(result.details).toEqual({ path: "findings.md", bytes: 15, replaced: false });
		// The text is not echoed. The agent has it already, and repeating it spends the
		// caller's context on something it just wrote.
		expect(textOf(result)).not.toContain("the answer is 3");
	});

	it("creates the directories on the way", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		// A tool that refused this because `notes/` did not exist yet would make the model
		// spend a turn discovering that and a second turn working around it.
		const result = await tool.execute("t1", { path: "notes/deep/riemann.md", text: "zeros" });

		expect(result.isError).toBeUndefined();
		expect(fs.readFileSync(path.join(root, "notes/deep/riemann.md"), "utf8")).toBe("zeros");
	});

	it("overwrites an existing file and says that it replaced something", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		await tool.execute("t1", { path: "notes.md", text: "first worker" });
		const result = await tool.execute("t2", { path: "notes.md", text: "second worker" });

		expect(result.isError).toBeUndefined();
		expect(fs.readFileSync(path.join(root, "notes.md"), "utf8")).toBe("second worker");
		// A model that cannot tell "created" from "replaced" cannot tell the person that it
		// destroyed the previous worker's notes.
		expect(result.details).toMatchObject({ replaced: true });
		expect(textOf(result)).toContain("Replaced");
	});

	it("refuses an absolute path", async () => {
		const root = tempDir();
		const outside = tempDir();
		const tool = createSaveTool({ root });
		const escape = path.join(outside, "owned.md");

		const result = await tool.execute("t1", { path: escape, text: "x" });

		// This is the whole reason the tool exists. pi's resolver "handles ~ expansion and
		// absolute paths", so the same call through pi's `write` would land here.
		expect(result.isError).toBe(true);
		expect(fs.existsSync(escape)).toBe(false);
	});

	it("refuses a path that climbs out with `..`", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		const result = await tool.execute("t1", { path: "../owned.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(fs.existsSync(path.join(root, "../owned.md"))).toBe(false);
	});

	it("refuses a path that only escapes once it is worked out", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		// The form a check on the first segment misses: it starts inside `notes/`, and only
		// the resolved path is a sibling of the root.
		const result = await tool.execute("t1", { path: "notes/../../owned.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(fs.existsSync(path.resolve(root, "../owned.md"))).toBe(false);
	});

	it("refuses a backslash escape, which is a separator wherever the file is read", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		const result = await tool.execute("t1", { path: "notes\\..\\..\\owned.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(fs.readdirSync(root)).toEqual([]);
	});

	it("refuses a path that names no file", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		for (const given of ["", ".", "/", "//", "./"]) {
			const result = await tool.execute("t1", { path: given, text: "x" });
			expect(result.isError).toBe(true);
		}
		expect(fs.readdirSync(root)).toEqual([]);
	});

	it("refuses a path with a null byte", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		// Node throws on this rather than returning an error, and a thrown tool call tells the
		// model nothing it can correct.
		const result = await tool.execute("t1", { path: "notes\0.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("null byte");
	});

	it("refuses a leading `~` rather than making a directory called `~`", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		// pi's own resolver expands it. A model carrying that habit here would otherwise get a
		// file under a directory literally named `~`, and never learn which of the two happened.
		const result = await tool.execute("t1", { path: "~/notes.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(fs.readdirSync(root)).toEqual([]);
	});

	it("refuses text over the byte limit and writes nothing", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root, maxBytes: 16 });

		const result = await tool.execute("t1", { path: "big.md", text: "x".repeat(17) });

		// An agent that loops on a growing file must hit the wall in this process, where the
		// refusal is something it can read, and not in the filesystem.
		expect(result.isError).toBe(true);
		expect(fs.existsSync(path.join(root, "big.md"))).toBe(false);
	});

	it("counts the limit in bytes, not in characters", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root, maxBytes: 16 });

		// Six characters, eighteen bytes in UTF-8. A cap read as a character count would let
		// this file be three times the size the operator agreed to.
		const result = await tool.execute("t1", { path: "cjk.md", text: "文字文字文字" });

		expect(result.isError).toBe(true);
		expect(fs.existsSync(path.join(root, "cjk.md"))).toBe(false);
	});

	it("writes right up to the limit", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root, maxBytes: 16 });

		const result = await tool.execute("t1", { path: "exact.md", text: "x".repeat(16) });

		expect(result.isError).toBeUndefined();
		expect(result.details).toMatchObject({ bytes: 16 });
	});

	it("refuses to write through a directory inside the root that links out of it", async () => {
		const root = tempDir();
		const outside = tempDir();
		const tool = createSaveTool({ root });
		fs.symlinkSync(outside, path.join(root, "notes"));

		// Every check on the text of the path passes: `notes/owned.md` reads as a child. Only
		// asking the operating system where `notes` really is catches this one.
		const result = await tool.execute("t1", { path: "notes/owned.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(fs.existsSync(path.join(outside, "owned.md"))).toBe(false);
	});

	it("refuses to write through a symbolic link at the destination", async () => {
		const root = tempDir();
		const outside = tempDir();
		const tool = createSaveTool({ root });
		const escape = path.join(outside, "owned.md");
		fs.symlinkSync(escape, path.join(root, "report.md"));

		const result = await tool.execute("t1", { path: "report.md", text: "x" });

		expect(result.isError).toBe(true);
		expect(fs.existsSync(escape)).toBe(false);
	});

	it("still refuses when the link inside the root points at another place inside it", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });
		fs.mkdirSync(path.join(root, "real"));
		fs.symlinkSync(path.join(root, "real"), path.join(root, "alias"));

		// Documented, not incidental. A link that stays inside the root is harmless, and this
		// one is refused anyway: the destination check reads the link itself, before it reads
		// where it points. Nothing an agent writes needs it, and a rule with an exception is a
		// rule somebody has to reason about at the moment it matters.
		const result = await tool.execute("t1", { path: "alias", text: "x" });

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("symbolic link");
	});

	it("writes under a symlinked root, because the root itself may be one", async () => {
		// On macOS the temporary directory is `/var/...`, a symlink to `/private/var/...`. A
		// containment test against the unresolved root would refuse every path in these tests.
		const root = tempDir();
		const tool = createSaveTool({ root });

		const result = await tool.execute("t1", { path: "a/b.md", text: "x" });

		expect(result.isError).toBeUndefined();
		expect(fs.readFileSync(path.join(root, "a/b.md"), "utf8")).toBe("x");
	});

	it("refuses a path where a directory already stands", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });
		fs.mkdirSync(path.join(root, "notes"));

		const result = await tool.execute("t1", { path: "notes", text: "x" });

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("already a directory");
	});

	it("refuses a call whose text is missing", async () => {
		const root = tempDir();
		const tool = createSaveTool({ root });

		const result = await tool.execute("t1", { path: "notes.md" });

		expect(result.isError).toBe(true);
		expect(fs.readdirSync(root)).toEqual([]);
	});
});
