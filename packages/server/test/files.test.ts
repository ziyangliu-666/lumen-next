/**
 * The read-only browser's two functions, checked against a real directory.
 *
 * `listDir` shares its containment check with `save`'s own tests, so this file does not
 * repeat every symlink and `..` case — see `kernel/test/save.test.ts` for those. What is
 * specific to this file is `readFile`'s split between the two kinds of content it can send: a
 * recognized image or PDF extension goes out as base64 with a MIME type, and everything else
 * stays on the plain-text path it always had, each held to its own size cap.
 */

import { afterAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listDir, readFile } from "../src/files.ts";

const made: string[] = [];

/** A fresh directory per test, so one test's files cannot answer another test's question. */
function tempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-files-"));
	made.push(dir);
	return dir;
}

afterAll(() => {
	for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readFile — text", () => {
	it("reads a UTF-8 file as text", () => {
		const root = tempDir();
		fs.writeFileSync(path.join(root, "notes.md"), "the answer is 3", "utf8");

		const result = readFile(root, "notes.md");

		expect(result).toEqual({ content: { kind: "text", text: "the answer is 3" } });
	});

	it("refuses a file that is not valid UTF-8", () => {
		const root = tempDir();
		// A lone continuation byte: not valid UTF-8 on its own.
		fs.writeFileSync(path.join(root, "raw.bin"), Buffer.from([0xff, 0xfe, 0x00]));

		const result = readFile(root, "raw.bin");

		expect("error" in result).toBe(true);
	});

	it("refuses a text file over the text size cap", () => {
		const root = tempDir();
		// One byte past `DEFAULT_MAX_BYTES` (256 KiB), so the cap itself is what refuses it.
		fs.writeFileSync(path.join(root, "big.txt"), "a".repeat(256 * 1024 + 1), "utf8");

		const result = readFile(root, "big.txt");

		expect("error" in result).toBe(true);
		if ("error" in result) expect(result.error).toMatch(/262144-byte limit/);
	});
});

describe("readFile — image and PDF", () => {
	it("reads a recognized image extension as base64, not text", () => {
		const root = tempDir();
		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // a PNG's magic bytes
		fs.writeFileSync(path.join(root, "diagram.png"), bytes);

		const result = readFile(root, "diagram.png");

		expect(result).toEqual({
			content: { kind: "binary", mime: "image/png", base64: bytes.toString("base64") },
		});
	});

	it("reads a PDF the same way, under its own MIME type", () => {
		const root = tempDir();
		const bytes = Buffer.from("%PDF-1.4\n...", "utf8");
		fs.writeFileSync(path.join(root, "report.pdf"), bytes);

		const result = readFile(root, "report.pdf");

		expect(result).toEqual({
			content: { kind: "binary", mime: "application/pdf", base64: bytes.toString("base64") },
		});
	});

	it("is not fooled by an image extension on non-UTF-8-invalid content — it never checks UTF-8 at all", () => {
		const root = tempDir();
		// Bytes that would fail the UTF-8 check a text file goes through. An image extension
		// must skip that check entirely rather than refuse the file for failing it.
		const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // a JPEG's magic bytes
		fs.writeFileSync(path.join(root, "photo.jpg"), bytes);

		const result = readFile(root, "photo.jpg");

		expect("error" in result).toBe(false);
		if (!("error" in result)) expect(result.content.kind).toBe("binary");
	});

	it("is capped by the larger preview limit, not the text limit", () => {
		const root = tempDir();
		// Bigger than `DEFAULT_MAX_BYTES` (256 KiB) but under `MAX_PREVIEW_BYTES` (8 MiB): an
		// image this size must still preview, where a text file this size is refused above.
		const bytes = Buffer.alloc(512 * 1024, 1);
		fs.writeFileSync(path.join(root, "big.png"), bytes);

		const result = readFile(root, "big.png");

		expect("error" in result).toBe(false);
	});

	it("refuses an image over the preview size cap", () => {
		const root = tempDir();
		const bytes = Buffer.alloc(8 * 1024 * 1024 + 1, 1);
		fs.writeFileSync(path.join(root, "huge.png"), bytes);

		const result = readFile(root, "huge.png");

		expect("error" in result).toBe(true);
	});

	it("treats the extension as case-insensitive", () => {
		const root = tempDir();
		const bytes = Buffer.from([1, 2, 3]);
		fs.writeFileSync(path.join(root, "SCREEN.PNG"), bytes);

		const result = readFile(root, "SCREEN.PNG");

		expect("error" in result).toBe(false);
		if (!("error" in result)) expect(result.content).toEqual({ kind: "binary", mime: "image/png", base64: bytes.toString("base64") });
	});
});

describe("readFile — the containment and shape checks readFile always had", () => {
	it("refuses a directory", () => {
		const root = tempDir();
		fs.mkdirSync(path.join(root, "notes"));

		const result = readFile(root, "notes");

		expect("error" in result).toBe(true);
	});

	it("refuses a path that does not exist", () => {
		const root = tempDir();

		const result = readFile(root, "nothing-here.md");

		expect("error" in result).toBe(true);
	});
});

describe("listDir", () => {
	it("lists files and directories, directories first, alphabetically within each", () => {
		const root = tempDir();
		fs.writeFileSync(path.join(root, "b.txt"), "");
		fs.writeFileSync(path.join(root, "a.txt"), "");
		fs.mkdirSync(path.join(root, "z-dir"));
		fs.mkdirSync(path.join(root, "y-dir"));

		const result = listDir(root, "");

		expect(result).toEqual([
			{ name: "y-dir", kind: "dir" },
			{ name: "z-dir", kind: "dir" },
			{ name: "a.txt", kind: "file" },
			{ name: "b.txt", kind: "file" },
		]);
	});
});
