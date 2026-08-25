/**
 * A read-only look at this conversation's own directory: the working directory `save` writes
 * into, drawn as a collapsible tree beside the canvas.
 *
 * Deliberately a viewer, not a file manager. There is no upload, no rename, no delete, and no
 * edit — the only two frames this component sends are `files.list` and `files.read`, and the
 * server enforces the read-only half of that by calling functions that only know how to read
 * (see `packages/server/src/files.ts`). A folder is fetched the first time it is opened, not
 * before, so a directory with hundreds of files costs nothing until somebody actually looks.
 *
 * A folder already open stays live. `state.ts` drops a directory's cached listing the moment
 * a `save` step closes inside it, and the effect below notices the gap in `state.files.tree`
 * and asks for that path again — so a file an agent just wrote shows up in a folder you
 * already had open, without a manual refresh and without this component polling anything.
 *
 * The preview pane reads five shapes of file, each through the path already trusted for it
 * elsewhere in this app:
 *
 *   markdown   `markdown.ts` + `Prose.tsx`, the same parser an agent's own answers go through.
 *              No second markdown engine — see `Prose.tsx`'s header for why that split is the
 *              whole security property of this app: a hostile page an agent fetched can only
 *              ever come out as visible text, never as markup a browser executes.
 *   CSV / TSV  cells split by hand below and written out as an HTML table built from React
 *              elements, the same "data, not a string" shape everything else on this list
 *              already keeps to. A row this app did not ask for cannot smuggle in a tag this
 *              way any more than a markdown table can.
 *   code       `prism-react-renderer`, which renders React elements token by token and never
 *              builds an HTML string either — the one dependency this file adds, and it holds
 *              to the same invariant `Prose.tsx` does for the same reason: file content can
 *              come from anywhere an agent's tools reached, including a page it fetched and
 *              saved to disk.
 *   image      a plain `<img>`, decoding whatever the server sent as base64 — see
 *              `packages/server/src/files.ts` for exactly which extensions take this path.
 *   PDF        a plain `<embed>`, pointed at the same base64 as a data URI. The browser's own
 *              built-in reader does the rest: pan, zoom, search, print, for free.
 *
 * Nothing else is a special case. A file with no markdown, CSV, code, image, or PDF
 * extension is plain text in a `<pre>`, exactly as it was before any of this existed.
 */

import { useEffect, useState } from "react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import type { ClientFrame } from "@lumen/server/protocol";
import type { FileContent, State } from "./state.ts";
import { Prose } from "./Prose.tsx";

type Entry = { name: string; kind: "file" | "dir" };

/** `.md` and `.markdown` read through `Prose.tsx`. Nothing else does. */
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);

/** `.csv` and `.tsv`, told apart only by which character splits a row into cells. */
const DELIMITED_EXTENSIONS: Record<string, string> = { csv: ",", tsv: "\t" };

/**
 * Extension to the language name `prism-react-renderer` actually knows.
 *
 * Not every language a person might save is here. This package ships a trimmed Prism core
 * plus roughly fifteen grammars, and asking it to highlight a language it does not have
 * throws rather than returning plain text — so this map only lists extensions that are
 * genuinely inside that set, checked against the package's own bundled `Prism.languages` at
 * the time this was written. An extension left out of this map still previews; it just does
 * so as plain text, in the same `<pre>` a file with no recognized extension at all uses.
 */
const CODE_LANGUAGES: Record<string, string> = {
	ts: "typescript",
	tsx: "tsx",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "jsx",
	json: "json",
	css: "css",
	html: "markup",
	htm: "markup",
	xml: "markup",
	yaml: "yaml",
	yml: "yaml",
	py: "python",
	rs: "rust",
	go: "go",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	m: "objectivec",
	swift: "swift",
	kt: "kotlin",
	kts: "kotlin",
	sql: "sql",
	graphql: "graphql",
	gql: "graphql",
	coffee: "coffeescript",
};

/**
 * Prism's token colors, mapped onto `app.css`'s own custom properties instead of one of the
 * package's stock themes. A stock theme brings its own palette and would sit next to the rest
 * of this dark, five-color interface as a visibly different application; this reuses the same
 * five tokens everything else here is built from, so a highlighted file reads as part of the
 * same page.
 */
const codeTheme: PrismTheme = {
	plain: { color: "var(--text)" },
	styles: [
		{ types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--dim)", fontStyle: "italic" } },
		{ types: ["punctuation"], style: { color: "var(--dim)" } },
		{
			types: ["property", "tag", "boolean", "number", "constant", "symbol", "deleted"],
			style: { color: "var(--warn)" },
		},
		{
			types: ["selector", "attr-name", "string", "char", "builtin", "inserted"],
			style: { color: "var(--ok)" },
		},
		{ types: ["atrule", "attr-value", "keyword"], style: { color: "var(--accent)" } },
		{ types: ["function", "class-name"], style: { color: "var(--warn)" } },
		{ types: ["regex", "important", "variable"], style: { color: "var(--bad)" } },
	],
};

/**
 * Split a CSV or TSV file into rows of cells, RFC 4180 quoting included: a field wrapped in
 * `"..."` may hold the delimiter, a newline, or a doubled `""` for one literal quote.
 *
 * Without this, a preview built by splitting on the delimiter and on `\n` would cut a quoted
 * field in half the moment its own value contained a comma — the exact shape a numeric CSV's
 * header row rarely has and a text column often does.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;

	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				field += '"';
				i += 1;
			} else if (ch === '"') {
				quoted = false;
			} else {
				field += ch;
			}
			continue;
		}
		if (ch === '"') {
			quoted = true;
		} else if (ch === delimiter) {
			row.push(field);
			field = "";
		} else if (ch === "\r") {
			// Dropped rather than kept: a lone `\r` never means anything here, and a `\r\n` pair
			// would otherwise leave a trailing carriage return on the last cell of every row.
		} else if (ch === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += ch;
		}
	}
	// The final row, for a file that does not end in a newline. Skipped when there is plainly
	// nothing left to add, so a file that does end cleanly does not get a trailing empty row.
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

function DelimitedPreview({ text, delimiter }: { text: string; delimiter: string }) {
	const rows = parseDelimited(text, delimiter);
	if (rows.length === 0) return <p className="hint fileIndent">empty file</p>;
	const [header, ...body] = rows;
	return (
		<div className="filePreviewCsv">
			<table>
				<thead>
					<tr>
						{header.map((cell, index) => (
							<th key={index}>{cell}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{body.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{row.map((cell, index) => (
								<td key={index}>{cell}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** The extension of a path, lowercased and without the dot, or `""` for a name with none. */
function extOf(filePath: string): string {
	const name = filePath.slice(filePath.lastIndexOf("/") + 1);
	const dot = name.lastIndexOf(".");
	return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function Files({ state, send }: { state: State; send: (frame: ClientFrame) => void }) {
	// Which directories are open, by path. Local to this component: it is what this tab has
	// clicked open, not a fact about the run other tabs or the server need to know.
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	useEffect(() => {
		// Guarded on `connected` rather than fired unconditionally on mount: the socket is
		// still opening for the first render or two, and sending into it before it is open
		// throws instead of queuing.
		if (!state.connected) return;
		// The root plus every directory this tab has open, asked for whenever one of them
		// is missing from the tree. That covers the first request for a path (right after
		// `toggle` adds it to `expanded`) and a re-request after `state.ts` drops a stale
		// entry once a `save` step closes — one effect for both, rather than a direct send
		// in `toggle` that a background refresh would have to duplicate.
		const wanted = new Set(expanded);
		wanted.add("");
		for (const path of wanted) {
			if (!state.files.tree[path]) send({ type: "files.list", path });
		}
	}, [state.connected, expanded, state.files.tree, send]);

	function toggle(path: string) {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}

	const root = state.files.tree[""];
	const preview = state.files.preview;

	return (
		<div className="filesPane">
			<div className="filesHead">files</div>
			<div className="fileTree">
				{root === undefined ? (
					<p className="hint fileIndent">reading…</p>
				) : root.length === 0 ? (
					<p className="hint fileIndent">nothing here yet</p>
				) : (
					<FileList
						entries={root}
						parent=""
						state={state}
						expanded={expanded}
						toggle={toggle}
						onOpen={(path) => send({ type: "files.read", path })}
					/>
				)}
			</div>

			{preview && (
				<div className="filePreview">
					<div className="filePreviewHead">{preview.path}</div>
					<div className="filePreviewBody">
						<FilePreview path={preview.path} content={preview.content} />
					</div>
				</div>
			)}
		</div>
	);
}

function FileList({
	entries,
	parent,
	state,
	expanded,
	toggle,
	onOpen,
}: {
	entries: Entry[];
	parent: string;
	state: State;
	expanded: Set<string>;
	toggle: (path: string) => void;
	onOpen: (path: string) => void;
}) {
	return (
		<ul className="fileList">
			{entries.map((entry) => {
				const path = parent ? `${parent}/${entry.name}` : entry.name;
				if (entry.kind === "dir") {
					const open = expanded.has(path);
					const children = state.files.tree[path];
					return (
						<li key={path}>
							<button type="button" className="fileDir" onClick={() => toggle(path)}>
								<span className="fileDisclosure">{open ? "▾" : "▸"}</span>
								{entry.name}
							</button>
							{open &&
								(children === undefined ? (
									<p className="hint fileIndent">reading…</p>
								) : children.length === 0 ? (
									<p className="hint fileIndent">empty</p>
								) : (
									<FileList
										entries={children}
										parent={path}
										state={state}
										expanded={expanded}
										toggle={toggle}
										onOpen={onOpen}
									/>
								))}
						</li>
					);
				}
				return (
					<li key={path}>
						<button
							type="button"
							className={`fileLeaf${state.files.preview?.path === path ? " selected" : ""}`}
							onClick={() => onOpen(path)}
						>
							{entry.name}
						</button>
					</li>
				);
			})}
		</ul>
	);
}

/** One file's body, drawn the way its kind and extension say it should be. */
function FilePreview({ path, content }: { path: string; content: FileContent }) {
	if (content.kind === "binary") {
		const href = `data:${content.mime};base64,${content.base64}`;
		if (content.mime.startsWith("image/")) {
			return <img className="filePreviewImage" src={href} alt={path} />;
		}
		if (content.mime === "application/pdf") {
			return (
				<>
					<embed className="filePreviewPdf" src={href} type="application/pdf" />
					<p className="hint fileIndent">
						If the page above is blank, this browser has no built-in PDF reader.{" "}
						<a href={href} target="_blank" rel="noreferrer noopener">
							Open it in a new tab
						</a>{" "}
						instead.
					</p>
				</>
			);
		}
		// Not reachable today — `PREVIEW_MIME` in `files.ts` only ever names an image or a PDF
		// — but a mismatch between that map and this component should read as a plain message,
		// not a blank pane or a thrown error.
		return <p className="hint fileIndent">This file's type is not shown here.</p>;
	}

	const ext = extOf(path);
	if (MARKDOWN_EXTENSIONS.has(ext)) {
		return <Prose text={content.text} />;
	}

	const delimiter = DELIMITED_EXTENSIONS[ext];
	if (delimiter) {
		return <DelimitedPreview text={content.text} delimiter={delimiter} />;
	}

	const language = CODE_LANGUAGES[ext];
	if (language) {
		return (
			<Highlight code={content.text} language={language} theme={codeTheme}>
				{({ tokens, getLineProps, getTokenProps }) => (
					<pre className="filePreviewCode">
						<code>
							{tokens.map((line, i) => (
								<div key={i} {...getLineProps({ line })}>
									{line.map((token, k) => (
										<span key={k} {...getTokenProps({ token })} />
									))}
								</div>
							))}
						</code>
					</pre>
				)}
			</Highlight>
		);
	}

	return <pre className="filePreviewText">{content.text}</pre>;
}
