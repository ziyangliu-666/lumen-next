/**
 * An agent's answer, parsed into data. Never into HTML.
 *
 * A node's `summary` is the product of the whole run, and until now it went into a div as a
 * raw string, so the reader saw the source instead of the answer: `– **Trace** class:
 * \`packages/kernel/src/trace/trace.ts:36\`. This module turns that string into a tree of
 * plain objects, and a separate file renders the tree as React elements.
 *
 * The split is the security property, and it is absolute: nothing here produces HTML, an
 * HTML string, or anything that could be handed to `dangerouslySetInnerHTML`. The text
 * being parsed is not all written by the agents. They hold `web_search` and
 * `fetch_content`, so a hostile page's markup arrives inside a summary, travels through the
 * trace, and lands here. Because the output is data and React writes it out as elements,
 * a `<script>` in the input can only ever appear on screen as the visible characters
 * `<script>`. There is no path from this file to executable markup, and adding one — even
 * an "escaped HTML" fast path — would remove the only reason this parser exists.
 *
 * It is deliberately small. The input is agent prose written to a house style, not
 * arbitrary user markdown, so this supports the subset the agents actually write and stops
 * there. Images, footnotes, reference links, setext headings and inline HTML are absent on
 * purpose. A general engine would be more code, more corners, and every extra corner is
 * another place where someone would be tempted to pass markup through.
 *
 * Pipe tables are the one addition past that line, because they are not a prose feature —
 * they are how an agent's `save`d report presents rows and columns, the same job a CSV
 * preview does elsewhere in this app, and a table an agent wrote for that reason was landing
 * on screen as a wall of literal `|` characters instead. The same rule still holds: a table
 * becomes a data node with cells of `Inline[]`, never a string of HTML, so a hostile page
 * quoted inside a cell is exactly as inert here as it is inside a paragraph.
 *
 * Math is the other addition, for the same kind of reason: this app is aimed at mathematical
 * research, agents write LaTeX in nearly every answer, and `$x^2$` was landing on screen as
 * the literal characters `$x^2$`. A `math` node carries the TeX source as a plain string,
 * nothing more — this file never touches a LaTeX engine, so it cannot know whether the TeX
 * inside is even valid. Turning that string into a formula is `Prose.tsx`'s job, and it does
 * so through a path that never builds an HTML string either, for the reason explained there.
 */

export type Inline =
	| { kind: "text"; text: string }
	| { kind: "code"; text: string }
	| { kind: "strong"; children: Inline[] }
	| { kind: "em"; children: Inline[] }
	| { kind: "link"; href: string; children: Inline[] }
	/** A place in the repository the agent is pointing at: `src/x.ts:36`. */
	| { kind: "ref"; path: string; line?: number; text: string }
	/** A formula. `display` is `$$…$$` (its own centered line) versus `$…$` (sits in a sentence). */
	| { kind: "math"; tex: string; display: boolean };

/** Where a column's text sits, read off its delimiter cell. `null` is the browser's own default. */
export type Align = "left" | "center" | "right" | null;

export type Block =
	| { kind: "para"; children: Inline[] }
	| { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
	| { kind: "list"; ordered: boolean; items: Inline[][] }
	| { kind: "code"; lang?: string; text: string }
	| { kind: "quote"; children: Block[] }
	| { kind: "rule" }
	| { kind: "table"; align: Align[]; header: Inline[][]; rows: Inline[][][] };

/**
 * Extensions that make a bare word a repository path.
 *
 * Longest first, because the alternation is tried in order and `main.ts|x` would otherwise
 * match `main.ts` and leave a stray `x` behind. The lookahead in `REF_PATTERN` catches that
 * too; both are kept, because the list is edited by hand and the order is easy to lose.
 */
const REF_EXTENSIONS = [
	"svelte",
	"scss",
	"toml",
	"yaml",
	"json",
	"html",
	"java",
	"tsx",
	"jsx",
	"mjs",
	"cjs",
	"cpp",
	"hpp",
	"yml",
	"css",
	"php",
	"sql",
	"txt",
	"vue",
	"swift",
	"kt",
	"ts",
	"js",
	"py",
	"rs",
	"go",
	"rb",
	"cs",
	"sh",
	"md",
	"c",
	"h",
];

/**
 * A path, and the line number the agent pointed at.
 *
 * Refs are the reason this parser exists. Every agent here is told to quote `path:line` for
 * anything specific, so they are the most valuable characters on the screen, and today they
 * are drawn as ordinary prose.
 *
 * The last segment must carry a known extension. The looser rule — anything containing a
 * slash — turned `and/or` and `example.com/page` into links to files that do not exist, and
 * a wrong link costs more than a missed one: the reader clicks it and learns nothing, then
 * stops trusting the ones that are right. The cost of the strict rule is that a directory,
 * `packages/web/src`, stays plain text.
 */
const REF_PATTERN = new RegExp(
	`(?:[\\w.-]+/)*[\\w.-]+\\.(?:${REF_EXTENSIONS.join("|")})(?![\\w-])(?::(\\d+))?`,
	"g",
);

/** Anchored twin of `REF_PATTERN`, for deciding whether a code span is really a path. */
const WHOLE_REF_PATTERN = new RegExp(`^(?:${REF_PATTERN.source})$`);

/**
 * A bare URL. It stops at whitespace and at the brackets and quotes that fence one in prose,
 * so `(see https://a.example/b)` does not link the closing bracket. The price is a URL that
 * contains a bracket of its own, which ends up cut short; that is rarer than the sentence.
 */
const URL_PATTERN = /^https?:\/\/[^\s<>()[\]"'`]+/;

/** Schemes a link may carry. Everything else is refused; see `safeHref`. */
const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);

const FENCE_OPEN = /^\s{0,3}```\s*([^\s`]*)/;
const FENCE_CLOSE = /^\s{0,3}```\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;

/** One cell of a table's delimiter row: dashes, with an optional colon on either side for alignment. */
const TABLE_DELIM_CELL = /^:?-+:?$/;

/**
 * Split one row of a pipe table into its cells.
 *
 * A leading and trailing `|` are the usual style and are dropped rather than read as empty
 * outer cells; a backslash-escaped `\|` is kept as a literal pipe inside a cell instead of
 * ending it, which matters for any cell quoting a path or a shell pipeline.
 */
function splitTableRow(line: string): string[] {
	let body = line.trim();
	if (body.startsWith("|")) body = body.slice(1);
	if (body.endsWith("|") && !body.endsWith("\\|")) body = body.slice(0, -1);

	const cells: string[] = [];
	let cell = "";
	for (let i = 0; i < body.length; i += 1) {
		if (body[i] === "\\" && body[i + 1] === "|") {
			cell += "|";
			i += 1;
			continue;
		}
		if (body[i] === "|") {
			cells.push(cell.trim());
			cell = "";
			continue;
		}
		cell += body[i];
	}
	cells.push(cell.trim());
	return cells;
}

/**
 * Whether `line` opens a table, given the line right after it.
 *
 * A table is told apart from an ordinary line containing a stray `|` only by what follows
 * it: a delimiter row of dash cells, one per column. Requiring a `|` on the header line too
 * keeps a single-column table (no pipes anywhere, just a dashed line under a word) out of
 * scope — that shape is indistinguishable from `RULE` and from the setext headings this
 * parser already leaves out on purpose.
 */
function isTableStart(line: string, next: string | undefined): boolean {
	if (next === undefined || !line.includes("|")) return false;
	const delimCells = splitTableRow(next);
	return delimCells.length > 0 && delimCells.every((cell) => TABLE_DELIM_CELL.test(cell));
}

/** A delimiter cell's colons, read as the alignment its whole column takes. */
function alignOf(cell: string): Align {
	const left = cell.startsWith(":");
	const right = cell.endsWith(":");
	if (left && right) return "center";
	if (right) return "right";
	if (left) return "left";
	return null;
}

export function parse(markdown: string): Block[] {
	const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
	const blocks: Block[] = [];
	let at = 0;

	while (at < lines.length) {
		const line = lines[at];

		if (line.trim() === "") {
			at += 1;
			continue;
		}

		const fence = FENCE_OPEN.exec(line);
		if (fence) {
			const body: string[] = [];
			at += 1;
			// A fence with no closer takes the rest of the input rather than falling back to
			// paragraphs. Both readings lose something; this one loses only the monospace of a
			// few lines, while re-parsing the body as prose would run emphasis and link rules
			// over code the agent asked us not to touch.
			while (at < lines.length && !FENCE_CLOSE.test(lines[at])) {
				body.push(lines[at]);
				at += 1;
			}
			at += 1;
			const lang = fence[1];
			blocks.push(lang ? { kind: "code", lang, text: body.join("\n") } : { kind: "code", text: body.join("\n") });
			continue;
		}

		// Before the bullet rule, because `---` is a rule and `- x` is a list, and only the
		// order of these two tests tells them apart.
		if (RULE.test(line)) {
			blocks.push({ kind: "rule" });
			at += 1;
			continue;
		}

		const heading = HEADING.exec(line);
		if (heading) {
			blocks.push({
				kind: "heading",
				level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
				children: parseInline(heading[2].trim()),
			});
			at += 1;
			continue;
		}

		if (isTableStart(line, lines[at + 1])) {
			const align = splitTableRow(lines[at + 1]).map(alignOf);
			const header = splitTableRow(line).map((cell) => parseInline(cell));
			at += 2;
			const rows: Inline[][][] = [];
			// A row stops the table the same way a paragraph line stops: a blank line, or the
			// start of something else this parser already knows. Unlike the header, a body row
			// needs no `|` of its own — GFM pads a row with fewer cells than the header — but in
			// practice every row an agent writes carries one, and requiring it keeps a plain
			// sentence that follows the table from being read as a one-cell row.
			while (at < lines.length && lines[at].trim() !== "" && lines[at].includes("|") && !startsBlock(lines[at])) {
				rows.push(splitTableRow(lines[at]).map((cell) => parseInline(cell)));
				at += 1;
			}
			blocks.push({ kind: "table", align, header, rows });
			continue;
		}

		if (QUOTE.test(line)) {
			const quoted: string[] = [];
			while (at < lines.length && QUOTE.test(lines[at])) {
				quoted.push(lines[at].replace(/^\s{0,3}>\s?/, ""));
				at += 1;
			}
			blocks.push({ kind: "quote", children: parse(quoted.join("\n")) });
			continue;
		}

		const item = BULLET.exec(line) ?? ORDERED.exec(line);
		if (item) {
			const ordered = ORDERED.test(line);
			const items: Inline[][] = [];
			// Indentation is read and thrown away. A nested item becomes a sibling of its
			// parent instead of a child, because `Block` has no list-inside-list shape and the
			// alternative is to drop the line. The indented line is usually the agent's most
			// specific finding, so losing it would cut exactly the sentence worth reading.
			while (at < lines.length) {
				const next = BULLET.exec(lines[at]) ?? ORDERED.exec(lines[at]);
				if (!next || ORDERED.test(lines[at]) !== ordered) break;
				items.push(parseInline(next[2]));
				at += 1;
			}
			blocks.push({ kind: "list", ordered, items });
			continue;
		}

		const paragraph: string[] = [];
		while (
			at < lines.length &&
			lines[at].trim() !== "" &&
			!startsBlock(lines[at]) &&
			!isTableStart(lines[at], lines[at + 1])
		) {
			paragraph.push(lines[at].trim());
			at += 1;
		}
		// Joined with the newline the agent wrote, not a space. A renderer that collapses
		// whitespace still sees a space; one that sets `pre-wrap` can honour the agent's own
		// wrapping. Joining with a space would have destroyed that choice here.
		blocks.push({ kind: "para", children: parseInline(paragraph.join("\n")) });
	}

	return blocks;
}

/** Whether a line inside a paragraph starts something else and therefore ends it. */
function startsBlock(line: string): boolean {
	return (
		FENCE_OPEN.test(line) ||
		RULE.test(line) ||
		HEADING.test(line) ||
		QUOTE.test(line) ||
		BULLET.test(line) ||
		ORDERED.test(line)
	);
}

/**
 * One pass over the text, marker by marker.
 *
 * Every branch that fails to find its closing marker writes the marker out as literal text
 * and advances past it. That is what makes an unterminated `**` safe: the characters are
 * kept, the loop always moves forward, and nothing can spin.
 */
function parseInline(source: string): Inline[] {
	const out: Inline[] = [];
	let plain = "";
	let at = 0;

	const flush = () => {
		if (plain === "") return;
		out.push(...scanRefs(plain));
		plain = "";
	};

	while (at < source.length) {
		const ch = source[at];

		if (ch === "`") {
			const close = source.indexOf("`", at + 1);
			if (close > at + 1) {
				flush();
				out.push(codeOrRef(source.slice(at + 1, close)));
				at = close + 1;
				continue;
			}
			plain += ch;
			at += 1;
			continue;
		}

		if (ch === "$" && source.startsWith("$$", at)) {
			// `$$…$$` on one line is display math wherever it sits — inside a sentence or
			// alone as a paragraph of its own. There is no separate block-level scan for
			// it: a lone `$$…$$` paragraph reaches this function the same way any other
			// paragraph does, newlines and all, because the paragraph loop joins lines with
			// `\n` rather than a space (see the comment where it does that), and a display
			// formula's own body is just more characters inside that string.
			const close = source.indexOf("$$", at + 2);
			if (close > at + 2) {
				flush();
				out.push({ kind: "math", tex: source.slice(at + 2, close).trim(), display: true });
				at = close + 2;
				continue;
			}
			plain += "$$";
			at += 2;
			continue;
		}

		if (ch === "$") {
			const close = findInlineMathClose(source, at);
			if (close !== -1) {
				flush();
				out.push({ kind: "math", tex: source.slice(at + 1, close), display: false });
				at = close + 1;
				continue;
			}
			plain += ch;
			at += 1;
			continue;
		}

		if (ch === "*" && source.startsWith("**", at)) {
			const close = findStrongClose(source, at);
			if (close > at + 2) {
				flush();
				out.push({ kind: "strong", children: parseInline(source.slice(at + 2, close)) });
				at = close + 2;
				continue;
			}
			plain += "**";
			at += 2;
			continue;
		}

		if (ch === "*" || ch === "_") {
			const close = findEmphasisClose(source, at, ch);
			if (close !== -1) {
				flush();
				out.push({ kind: "em", children: parseInline(source.slice(at + 1, close)) });
				at = close + 1;
				continue;
			}
			plain += ch;
			at += 1;
			continue;
		}

		if (ch === "[") {
			const link = readLink(source, at);
			if (link) {
				flush();
				out.push(...link.nodes);
				at = link.end;
				continue;
			}
			plain += ch;
			at += 1;
			continue;
		}

		if (ch === "h") {
			const url = readBareUrl(source, at);
			if (url) {
				flush();
				out.push({ kind: "link", href: url, children: [{ kind: "text", text: url }] });
				at += url.length;
				continue;
			}
		}

		plain += ch;
		at += 1;
	}

	flush();
	return out;
}

/**
 * A code span, unless the agent wrote a path inside it.
 *
 * `\`packages/kernel/src/trace/trace.ts:36\`` is the house style for citing a place, and
 * the backticks are typography rather than meaning. Reading it as a code sample would hide
 * the one link on the line that the reader wants to follow.
 */
function codeOrRef(raw: string): Inline {
	const trimmed = raw.trim();
	if (WHOLE_REF_PATTERN.test(trimmed)) return makeRef(trimmed);
	return { kind: "code", text: raw };
}

/** Split plain text into `text` and `ref` nodes. Nothing else survives this stage. */
function scanRefs(text: string): Inline[] {
	const out: Inline[] = [];
	let last = 0;
	REF_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = REF_PATTERN.exec(text)) !== null) {
		const start = match.index;
		// A ref must begin where a word begins. Without this, the tail of an address or an
		// identifier — the `co/page.ts` inside a longer token — would be lifted out as a
		// repository path, and the characters before it would read as a broken sentence.
		if (start > 0 && /[\w./:-]/.test(text[start - 1])) continue;
		if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
		out.push(makeRef(match[0]));
		last = start + match[0].length;
	}

	if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
	return out;
}

function makeRef(raw: string): Inline {
	const numbered = /^(.*):(\d+)$/.exec(raw);
	if (numbered) return { kind: "ref", path: numbered[1], line: Number(numbered[2]), text: raw };
	return { kind: "ref", path: raw, text: raw };
}

/**
 * Find the `$` that closes inline math, or -1.
 *
 * A dollar sign is also currency, so a naive scan would read `$20,000 and $30,000` as one
 * formula stretching between the two prices. This follows the same rule Pandoc uses for its
 * own `$…$` math: the opener must hug its content (no space right after the `$`), the closer
 * must hug its content too (no space right before it), and the character right after the
 * closer must not be a digit — the detail that tells a second price apart from the end of a
 * formula and keeps the two prices separate.
 */
function findInlineMathClose(source: string, open: number): number {
	const after = source[open + 1] ?? "";
	if (after === "" || /\s/.test(after) || after === "$") return -1;

	let close = source.indexOf("$", open + 1);
	while (close !== -1) {
		const before = source[close - 1];
		const next = source[close + 1] ?? "";
		if (!/\s/.test(before) && !/\d/.test(next)) return close;
		close = source.indexOf("$", close + 1);
	}
	return -1;
}

/**
 * Find the `**` that closes strong, or -1.
 *
 * Both markers must touch their word. `a ** b ** c` is arithmetic in a sentence, and an
 * agent explaining a formula would otherwise have half of it bolded and the asterisks
 * taken away, which changes what the sentence says.
 */
function findStrongClose(source: string, open: number): number {
	const after = source[open + 2] ?? "";
	if (after === "" || /\s/.test(after)) return -1;

	let close = source.indexOf("**", open + 2);
	while (close !== -1 && /\s/.test(source[close - 1])) close = source.indexOf("**", close + 2);
	return close;
}

/**
 * Find the `*` or `_` that closes emphasis, or -1.
 *
 * The `_` rules are the strict ones, and they exist for one input: `some_file_name.ts`.
 * Treating the first underscore as an opener would emphasise the middle of a path and
 * split a ref in half, so an underscore only opens when it follows a non-word character.
 * The same test on the closing side keeps `a_b_c` whole.
 */
function findEmphasisClose(source: string, open: number, marker: string): number {
	const before = open > 0 ? source[open - 1] : " ";
	const after = source[open + 1] ?? "";
	if (after === "" || /\s/.test(after)) return -1;
	if (marker === "_" && /\w/.test(before)) return -1;

	for (let at = open + 2; at < source.length; at += 1) {
		if (source[at] !== marker) continue;
		if (/\s/.test(source[at - 1])) continue;
		const next = source[at + 1] ?? "";
		if (marker === "*" && next === "*") continue;
		if (marker === "_" && /\w/.test(next)) continue;
		return at;
	}
	return -1;
}

/** Read `[text](href)` at `at`, or null if it is not one. */
function readLink(source: string, at: number): { nodes: Inline[]; end: number } | null {
	const close = source.indexOf("]", at + 1);
	if (close === -1 || source[close + 1] !== "(") return null;
	const paren = source.indexOf(")", close + 2);
	if (paren === -1) return null;

	const children = parseInline(source.slice(at + 1, close));
	const href = safeHref(source.slice(close + 2, paren));
	// A refused href keeps the text and loses the link. The reader still gets the sentence,
	// and the one thing that could act — the destination — is gone.
	if (!href) return { nodes: children, end: paren + 1 };
	return { nodes: [{ kind: "link", href, children }], end: paren + 1 };
}

/**
 * The href, or null if it must not become a link.
 *
 * `javascript:` runs on click and `data:` can carry a whole document with its own script,
 * so both are refused. The parser cannot know which summaries quote a page the agent
 * fetched, and this file must be correct for the one that does.
 *
 * The test is an allow-list, not a list of bad schemes: a deny-list has to guess every
 * scheme a browser will ever honour, and it only has to be wrong once. Whitespace and
 * control characters are stripped first, because browsers ignore them inside a scheme and
 * `java\tscript:` would otherwise pass a naive check and still run.
 */
function safeHref(raw: string): string | null {
	const href = raw.trim();
	const probe = href.replace(/[\u0000-\u0020]/g, "").toLowerCase();
	const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe);
	if (!scheme) return href === "" ? null : href;
	return SAFE_SCHEMES.has(scheme[1]) ? href : null;
}

/** Read a bare `https://…` at `at`, without swallowing the punctuation that ends the sentence. */
function readBareUrl(source: string, at: number): string | null {
	const match = URL_PATTERN.exec(source.slice(at));
	if (!match) return null;
	let url = match[0];
	while (url.length > 0 && ".,;:!?".includes(url[url.length - 1])) url = url.slice(0, -1);
	// Re-test what is left, so that stripping the punctuation cannot leave a bare `https://`
	// standing as a link to nowhere.
	return URL_PATTERN.test(url) ? url : null;
}
