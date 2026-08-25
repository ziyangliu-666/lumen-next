/**
 * The answer, read as data.
 *
 * These tests pin two things. The first is that the shapes agents actually write come out
 * as the agent meant them, above all the `path:line` citation every agent here is told to
 * quote. The second is that nothing hostile can come out as anything but visible text,
 * because part of this input was fetched from the open web.
 */

import { describe, expect, it } from "vitest";
import { type Block, type Inline, parse } from "../src/markdown.ts";

/** Everything a reader would see, with the markup gone. Used where the exact tree is noise. */
function visible(nodes: Inline[]): string {
	return nodes
		.map((node) => {
			switch (node.kind) {
				case "text":
				case "code":
				case "ref":
					return node.text;
				default:
					return visible(node.children);
			}
		})
		.join("");
}

function anyLink(nodes: Inline[]): boolean {
	return nodes.some((node) =>
		node.kind === "link" ? true : "children" in node ? anyLink(node.children) : false,
	);
}

/** The inline nodes of a document that is one paragraph. */
function para(markdown: string): Inline[] {
	const blocks: Block[] = parse(markdown);
	expect(blocks).toHaveLength(1);
	expect(blocks[0].kind).toBe("para");
	return blocks[0].kind === "para" ? blocks[0].children : [];
}

describe("blocks", () => {
	it("returns nothing for empty input", () => {
		expect(parse("")).toEqual([]);
		expect(parse("\n   \n\n")).toEqual([]);
	});

	it("reads a heading at its own level", () => {
		expect(parse("## Findings")).toEqual([
			{ kind: "heading", level: 2, children: [{ kind: "text", text: "Findings" }] },
		]);
	});

	it("keeps a fenced block's language and its text unparsed", () => {
		// The body must survive untouched. Running the inline rules over it would turn the
		// `*` of a pointer dereference into emphasis, inside the one block that is quoted
		// because its exact characters matter.
		expect(parse("```ts\nconst a = **1**;\n```")).toEqual([
			{ kind: "code", lang: "ts", text: "const a = **1**;" },
		]);
	});

	it("omits the language when the fence carries none", () => {
		expect(parse("```\nplain\n```")).toEqual([{ kind: "code", text: "plain" }]);
	});

	it("numbers an ordered list and does not number a bullet list", () => {
		expect(parse("1. first\n2. second")).toEqual([
			{
				kind: "list",
				ordered: true,
				items: [[{ kind: "text", text: "first" }], [{ kind: "text", text: "second" }]],
			},
		]);
		expect(parse("- first\n* second\n+ third")).toEqual([
			{
				kind: "list",
				ordered: false,
				items: [
					[{ kind: "text", text: "first" }],
					[{ kind: "text", text: "second" }],
					[{ kind: "text", text: "third" }],
				],
			},
		]);
	});

	it("flattens a nested item into its parent list instead of dropping it", () => {
		// An indented item is usually the agent's most specific finding, so losing it would
		// cut the one line worth reading. There is no list-inside-list block, so it becomes a
		// sibling: less structure than the agent wrote, but no missing text.
		expect(parse("- top\n  - nested")).toEqual([
			{
				kind: "list",
				ordered: false,
				items: [[{ kind: "text", text: "top" }], [{ kind: "text", text: "nested" }]],
			},
		]);
	});

	it("parses a blockquote as blocks of its own", () => {
		expect(parse("> the answer is 3\n>\n> and it cost $0.0060")).toEqual([
			{
				kind: "quote",
				children: [
					{ kind: "para", children: [{ kind: "text", text: "the answer is 3" }] },
					{ kind: "para", children: [{ kind: "text", text: "and it cost $0.0060" }] },
				],
			},
		]);
	});

	it("reads three dashes as a rule and one dash as a list", () => {
		// The two rules overlap on the same character, and only their order tells them apart.
		expect(parse("---")).toEqual([{ kind: "rule" }]);
		expect(parse("- one")).toEqual([
			{ kind: "list", ordered: false, items: [[{ kind: "text", text: "one" }]] },
		]);
	});

	it("separates blocks on a blank line and joins the lines inside one", () => {
		expect(parse("first line\nsecond line\n\n# after")).toEqual([
			{ kind: "para", children: [{ kind: "text", text: "first line\nsecond line" }] },
			{ kind: "heading", level: 1, children: [{ kind: "text", text: "after" }] },
		]);
	});
});

describe("tables", () => {
	it("reads a pipe table into a header, its alignment, and its rows", () => {
		expect(parse("| Name | Cost |\n| :--- | ---: |\n| a | $1 |\n| b | $2 |")).toEqual([
			{
				kind: "table",
				align: ["left", "right"],
				header: [[{ kind: "text", text: "Name" }], [{ kind: "text", text: "Cost" }]],
				rows: [
					[[{ kind: "text", text: "a" }], [{ kind: "text", text: "$1" }]],
					[[{ kind: "text", text: "b" }], [{ kind: "text", text: "$2" }]],
				],
			},
		]);
	});

	it("reads a table with no leading or trailing pipes", () => {
		expect(parse("Name | Cost\n--- | ---\na | 1")).toEqual([
			{
				kind: "table",
				align: [null, null],
				header: [[{ kind: "text", text: "Name" }], [{ kind: "text", text: "Cost" }]],
				rows: [[[{ kind: "text", text: "a" }], [{ kind: "text", text: "1" }]]],
			},
		]);
	});

	it("ends a table at the first blank line", () => {
		const blocks = parse("| a |\n| --- |\n| 1 |\n\nafter");
		expect(blocks).toHaveLength(2);
		expect(blocks[0].kind).toBe("table");
		expect(blocks[1]).toEqual({ kind: "para", children: [{ kind: "text", text: "after" }] });
	});

	it("ends a paragraph at a table that follows it with no blank line", () => {
		// GFM lets a table interrupt a paragraph; without this a report's sentence right
		// before its own table would swallow the header row as more prose.
		const blocks = parse("see below\n| a |\n| --- |\n| 1 |");
		expect(blocks).toEqual([
			{ kind: "para", children: [{ kind: "text", text: "see below" }] },
			{ kind: "table", align: [null], header: [[{ kind: "text", text: "a" }]], rows: [[[{ kind: "text", text: "1" }]]] },
		]);
	});

	it("does not read a rule or an ordinary line with one stray pipe as a table", () => {
		expect(parse("---")).toEqual([{ kind: "rule" }]);
		expect(parse("cost: $5 | still one sentence")).toEqual([
			{ kind: "para", children: [{ kind: "text", text: "cost: $5 | still one sentence" }] },
		]);
	});

	it("keeps an escaped pipe inside one cell instead of splitting on it", () => {
		expect(parse("| cmd |\n| --- |\n| a \\| b |")).toEqual([
			{
				kind: "table",
				align: [null],
				header: [[{ kind: "text", text: "cmd" }]],
				rows: [[[{ kind: "text", text: "a | b" }]]],
			},
		]);
	});

	it("runs inline rules over a cell, refs included", () => {
		const blocks = parse("| file | note |\n| --- | --- |\n| `a.ts:12` | **bad** |");
		expect(blocks).toEqual([
			{
				kind: "table",
				align: [null, null],
				header: [[{ kind: "text", text: "file" }], [{ kind: "text", text: "note" }]],
				rows: [
					[
						[{ kind: "ref", path: "a.ts", line: 12, text: "a.ts:12" }],
						[{ kind: "strong", children: [{ kind: "text", text: "bad" }] }],
					],
				],
			},
		]);
	});
});

describe("math", () => {
	it("reads inline math inside a sentence", () => {
		expect(para("the area is $x^2$ square units")).toEqual([
			{ kind: "text", text: "the area is " },
			{ kind: "math", tex: "x^2", display: false },
			{ kind: "text", text: " square units" },
		]);
	});

	it("reads a display formula, on its own line, as one math node", () => {
		expect(parse("$$\\sum_{i=1}^n x_i$$")).toEqual([
			{ kind: "para", children: [{ kind: "math", tex: "\\sum_{i=1}^n x_i", display: true }] },
		]);
	});

	it("reads a display formula spanning several lines", () => {
		expect(parse("$$\n\\sum_{i=1}^n x_i\n$$")).toEqual([
			{ kind: "para", children: [{ kind: "math", tex: "\\sum_{i=1}^n x_i", display: true }] },
		]);
	});

	it("reads display math that sits inside a sentence", () => {
		expect(para("note that $$x^2$$ is the square")).toEqual([
			{ kind: "text", text: "note that " },
			{ kind: "math", tex: "x^2", display: true },
			{ kind: "text", text: " is the square" },
		]);
	});

	it("does not read a lone currency amount as unterminated math", () => {
		expect(para("it costs $5")).toEqual([{ kind: "text", text: "it costs $5" }]);
	});

	it("does not read two separate prices as one formula between them", () => {
		// Without the "not followed by a digit" rule, the first `$` would open and the `$`
		// right before "30,000" would look like a valid close, turning the words between two
		// prices into a formula.
		expect(para("it was $20,000 and now $30,000")).toEqual([
			{ kind: "text", text: "it was $20,000 and now $30,000" },
		]);
	});

	it("keeps the text of an unterminated inline math marker", () => {
		expect(para("run rate is $x with no close")).toEqual([
			{ kind: "text", text: "run rate is $x with no close" },
		]);
	});

	it("keeps the text of an unterminated display math marker without swallowing what follows", () => {
		const blocks = parse("$$\nx^2 with no close\n\nafter");
		expect(blocks).toHaveLength(2);
		expect(blocks[0]).toEqual({
			kind: "para",
			children: [{ kind: "text", text: "$$\nx^2 with no close" }],
		});
		expect(blocks[1]).toEqual({ kind: "para", children: [{ kind: "text", text: "after" }] });
	});

	it("runs math through a table cell like any other inline content", () => {
		const blocks = parse("| formula |\n| --- |\n| $x^2$ |");
		expect(blocks).toEqual([
			{
				kind: "table",
				align: [null],
				header: [[{ kind: "text", text: "formula" }]],
				rows: [[[{ kind: "math", tex: "x^2", display: false }]]],
			},
		]);
	});

	it("lets a code span win over a dollar sign inside it", () => {
		expect(para("run `echo $x`")).toEqual([
			{ kind: "text", text: "run " },
			{ kind: "code", text: "echo $x" },
		]);
	});
});

describe("inline", () => {
	it("reads the line shape agents actually write", () => {
		// One assertion for the house style: a bullet, a bolded name, a cited place, and a
		// snippet. This is the string that used to reach the screen as its own source.
		const blocks = parse(
			"- **Trace** class: `packages/kernel/src/trace/trace.ts:36` — `export class Trace {`",
		);
		expect(blocks).toEqual([
			{
				kind: "list",
				ordered: false,
				items: [
					[
						{ kind: "strong", children: [{ kind: "text", text: "Trace" }] },
						{ kind: "text", text: " class: " },
						{
							kind: "ref",
							path: "packages/kernel/src/trace/trace.ts",
							line: 36,
							text: "packages/kernel/src/trace/trace.ts:36",
						},
						{ kind: "text", text: " — " },
						{ kind: "code", text: "export class Trace {" },
					],
				],
			},
		]);
	});

	it("lets a code span win over the markers inside it", () => {
		expect(para("run `npm test -- **watch**`")).toEqual([
			{ kind: "text", text: "run " },
			{ kind: "code", text: "npm test -- **watch**" },
		]);
	});

	it("reads strong and both spellings of emphasis", () => {
		expect(para("**a** *b* _c_")).toEqual([
			{ kind: "strong", children: [{ kind: "text", text: "a" }] },
			{ kind: "text", text: " " },
			{ kind: "em", children: [{ kind: "text", text: "b" }] },
			{ kind: "text", text: " " },
			{ kind: "em", children: [{ kind: "text", text: "c" }] },
		]);
	});

	it("does not read arithmetic in a sentence as emphasis", () => {
		// A marker must touch its word. Without that, an agent explaining `2 ** 3` loses the
		// asterisks and gets half the formula bolded, which changes what the line says.
		expect(para("2 ** 3 and 4 * 5")).toEqual([{ kind: "text", text: "2 ** 3 and 4 * 5" }]);
	});

	it("keeps a link and the text inside it", () => {
		expect(para("[the trace](https://example.com/docs)")).toEqual([
			{
				kind: "link",
				href: "https://example.com/docs",
				children: [{ kind: "text", text: "the trace" }],
			},
		]);
	});

	it("turns a bare URL into a link without taking the next word", () => {
		expect(para("see https://example.com/docs for more")).toEqual([
			{ kind: "text", text: "see " },
			{
				kind: "link",
				href: "https://example.com/docs",
				children: [{ kind: "text", text: "https://example.com/docs" }],
			},
			{ kind: "text", text: " for more" },
		]);
	});
});

describe("refs", () => {
	it("reads a path with a line number", () => {
		expect(para("look at packages/web/src/layout.ts:36 first")).toEqual([
			{ kind: "text", text: "look at " },
			{
				kind: "ref",
				path: "packages/web/src/layout.ts",
				line: 36,
				text: "packages/web/src/layout.ts:36",
			},
			{ kind: "text", text: " first" },
		]);
	});

	it("reads a path with no line number", () => {
		expect(para("look at src/main.tsx now")).toEqual([
			{ kind: "text", text: "look at " },
			{ kind: "ref", path: "src/main.tsx", text: "src/main.tsx" },
			{ kind: "text", text: " now" },
		]);
	});

	it("leaves the punctuation that ends the sentence out of the path", () => {
		// The failure this pins is a dead link: `layout.ts.` is not a file, and a citation
		// that cannot be opened is worse than plain text, because the reader tries it.
		expect(para("It lives in packages/web/src/layout.ts.")).toEqual([
			{ kind: "text", text: "It lives in " },
			{ kind: "ref", path: "packages/web/src/layout.ts", text: "packages/web/src/layout.ts" },
			{ kind: "text", text: "." },
		]);
		expect(para("(see README.md:12)")).toEqual([
			{ kind: "text", text: "(see " },
			{ kind: "ref", path: "README.md", line: 12, text: "README.md:12" },
			{ kind: "text", text: ")" },
		]);
	});

	it("reads a backticked path as the place, not as a code sample", () => {
		// The agents write citations in backticks. Drawing that as a code span would hide the
		// only thing on the line the reader wants to open.
		expect(para("`src/state.ts:12` holds it")).toEqual([
			{ kind: "ref", path: "src/state.ts", line: 12, text: "src/state.ts:12" },
			{ kind: "text", text: " holds it" },
		]);
	});

	it("still reads a backticked shell command as code", () => {
		expect(para("`npx vitest --run`")).toEqual([{ kind: "code", text: "npx vitest --run" }]);
	});

	it("keeps an underscored file name whole", () => {
		// Emphasis on `_` would split `some_file_name.ts` in half and destroy the path. The
		// underscore only opens emphasis after a non-word character.
		expect(para("open some_file_name.ts")).toEqual([
			{ kind: "text", text: "open " },
			{ kind: "ref", path: "some_file_name.ts", text: "some_file_name.ts" },
		]);
	});

	it("does not turn ordinary prose with a slash into a citation", () => {
		// A wrong citation costs more than a missed one. `and/or` drawn as a file link teaches
		// the reader that the links mean nothing.
		expect(para("pick one and/or the other at example.com/page")).toEqual([
			{ kind: "text", text: "pick one and/or the other at example.com/page" },
		]);
	});
});

describe("safety", () => {
	it("refuses a javascript: link and keeps its text", () => {
		// The summary can quote a page an agent fetched, so a hostile href reaches this
		// parser. Dropping the href and keeping the words leaves the reader the sentence and
		// removes the only part that could act.
		expect(para("[click me](javascript:alert)")).toEqual([{ kind: "text", text: "click me" }]);

		const withArgs = para("[click me](javascript:alert(1))");
		expect(anyLink(withArgs)).toBe(false);
		expect(visible(withArgs)).toContain("click me");
	});

	it("refuses a data: link, which can carry a document of its own", () => {
		const nodes = para("[report](data:text/html;base64,PHNjcmlwdD4=)");
		expect(anyLink(nodes)).toBe(false);
		expect(visible(nodes)).toContain("report");
	});

	it("refuses a scheme hidden behind whitespace a browser ignores", () => {
		// `java\tscript:` runs in a browser. A check that reads the raw string sees an unknown
		// scheme, calls it relative, and emits the link.
		const nodes = para("[go](java\tscript:alert)");
		expect(anyLink(nodes)).toBe(false);
	});

	it("keeps a safe relative href", () => {
		expect(para("[here](/runs/42)")).toEqual([
			{ kind: "link", href: "/runs/42", children: [{ kind: "text", text: "here" }] },
		]);
	});

	it("returns raw HTML as text, so it can only ever be read and not run", () => {
		expect(para("<script>alert(1)</script>")).toEqual([
			{ kind: "text", text: "<script>alert(1)</script>" },
		]);
		expect(para('<img src=x onerror="alert(1)">')).toEqual([
			{ kind: "text", text: '<img src=x onerror="alert(1)">' },
		]);
	});
});

describe("broken markup", () => {
	it("keeps the text of an unterminated marker", () => {
		expect(para("**bold with no close")).toEqual([
			{ kind: "text", text: "**bold with no close" },
		]);
		expect(para("a `code span that never ends")).toEqual([
			{ kind: "text", text: "a `code span that never ends" },
		]);
		expect(visible(para("[text with no href"))).toBe("[text with no href");
	});

	it("closes an unclosed fence at the end of the input", () => {
		// A summary is truncated when it is long, so a fence with no closer is normal rather
		// than exotic. This test also proves the scanner terminates on it.
		expect(parse("```ts\nconst a = 1;")).toEqual([{ kind: "code", lang: "ts", text: "const a = 1;" }]);
	});
});
