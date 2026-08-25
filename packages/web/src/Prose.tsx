/**
 * An agent's answer, drawn.
 *
 * The answer is what this whole system produces, and until now it was put on screen as its
 * own source: `– **Trace** class: \`packages/kernel/src/trace/trace.ts:36\``, asterisks and
 * backticks and all.
 *
 * The split matters more here than in an ordinary app. Part of what an agent writes came
 * from web pages a worker fetched — they hold `web_search` and `fetch_content` — so a
 * hostile page's markup reaches this component. `markdown.ts` returns a data tree and this
 * file turns that tree into React elements. Nothing anywhere on the path builds an HTML
 * string, and there is no `dangerouslySetInnerHTML` to reach. Injected markup can only ever
 * come out as visible text.
 *
 * Keep it that way. The moment somebody renders a raw string here to support one more
 * markdown feature, every page any worker has ever read becomes executable.
 *
 * Math is the one node below that KaTeX builds instead of this file. `katex.render()` does
 * not return an HTML string for us to place — it calls `document.createElement` itself and
 * appends the finished formula to a DOM node we hand it through a `ref`, the same "give me a
 * node, not a string" shape React's own reconciler uses. Nothing on that path ever holds a
 * string of markup, so there is still no `dangerouslySetInnerHTML` anywhere in this file, and
 * a hostile `\href{javascript:alert(1)}{x}` inside a fetched page's math is refused by KaTeX's
 * own `trust: false` — its default, kept explicit below — rather than by anything checked here.
 */

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { ClientFrame } from "@lumen/server/protocol";
import { parse, type Block, type Inline } from "./markdown.ts";
import type { State } from "./state.ts";

/**
 * What a `Ref` needs to try opening the path it names in the file browser, instead of only
 * ever copying it. All three are optional and travel together: a caller with nothing to
 * open into (`Files.tsx`'s own preview of a markdown file, today) passes none of them, and
 * every `Ref` below falls back to the plain copy behavior it always had.
 */
export interface Opener {
	state: State;
	send: (frame: ClientFrame) => void;
	/** Bring the file browser column into view, so an open a person did not ask to see the
	 *  panel for is not a file that opens somewhere off screen. */
	onRevealFiles: () => void;
}

export function Prose({
	text,
	base,
	opener,
}: {
	text: string;
	base?: string;
	opener?: Opener;
}) {
	return (
		<div className="prose">
			{parse(text).map((block, index) => (
				<Blocks key={index} block={block} base={base} opener={opener} />
			))}
		</div>
	);
}

function Blocks({ block, base, opener }: { block: Block; base?: string; opener?: Opener }) {
	switch (block.kind) {
		case "para":
			return (
				<p>
					<Inlines nodes={block.children} base={base} opener={opener} />
				</p>
			);
		case "heading": {
			// Every level renders as one element and is told apart by a class. An agent's
			// heading levels are arbitrary — one writes `##` for what another writes `###` —
			// and honouring them literally made two answers side by side look like different
			// documents. The level still travels, for anyone who wants it later.
			const Tag = `h${Math.min(block.level, 6)}` as "h1";
			return (
				<Tag className={`proseHeading h${block.level}`}>
					<Inlines nodes={block.children} base={base} opener={opener} />
				</Tag>
			);
		}
		case "list": {
			const Tag = block.ordered ? "ol" : "ul";
			return (
				<Tag>
					{block.items.map((item, index) => (
						<li key={index}>
							<Inlines nodes={item} base={base} opener={opener} />
						</li>
					))}
				</Tag>
			);
		}
		case "code":
			return (
				<pre className="proseCode">
					<code>{block.text}</code>
				</pre>
			);
		case "quote":
			return (
				<blockquote>
					{block.children.map((child, index) => (
						<Blocks key={index} block={child} base={base} opener={opener} />
					))}
				</blockquote>
			);
		case "rule":
			return <hr />;
		case "table":
			return (
				<div className="tableScroll">
					<table>
						<thead>
							<tr>
								{block.header.map((cell, index) => (
									<th key={index} style={{ textAlign: block.align[index] ?? undefined }}>
										<Inlines nodes={cell} base={base} opener={opener} />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{block.rows.map((row, rowIndex) => (
								<tr key={rowIndex}>
									{row.map((cell, index) => (
										<td key={index} style={{ textAlign: block.align[index] ?? undefined }}>
											<Inlines nodes={cell} base={base} opener={opener} />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
	}
}

function Inlines({ nodes, base, opener }: { nodes: Inline[]; base?: string; opener?: Opener }) {
	return (
		<>
			{nodes.map((node, index) => (
				<One key={index} node={node} base={base} opener={opener} />
			))}
		</>
	);
}

function One({ node, base, opener }: { node: Inline; base?: string; opener?: Opener }) {
	switch (node.kind) {
		case "text":
			return <>{node.text}</>;
		case "code":
			return <code>{node.text}</code>;
		case "strong":
			return (
				<strong>
					<Inlines nodes={node.children} base={base} opener={opener} />
				</strong>
			);
		case "em":
			return (
				<em>
					<Inlines nodes={node.children} base={base} opener={opener} />
				</em>
			);
		case "link":
			// `noreferrer` as well as `noopener`: the pages an agent cites are pages nobody
			// vetted, and there is no reason to tell one of them where the reader came from.
			return (
				<a href={node.href} target="_blank" rel="noreferrer noopener">
					<Inlines nodes={node.children} base={base} opener={opener} />
				</a>
			);
		case "ref":
			return <Ref node={node} base={base} opener={opener} />;
		case "math":
			return <Formula tex={node.tex} display={node.display} />;
	}
}

/**
 * A formula, built by KaTeX directly into the `span` this component owns.
 *
 * `trust: false` is KaTeX's own default; it is set here anyway, in words, because it is the
 * whole reason a formula quoted from a fetched page cannot act — it refuses every one of
 * KaTeX's trust-gated commands (`\href`, `\includegraphics`, `\url`, and the rest), so
 * `\href{javascript:alert(1)}{x}` renders as an error message, never as a link. `throwOnError:
 * false` matches that: an agent's TeX is not guaranteed to be valid TeX, and a typo should
 * read as a small error note in the answer, not blank the rest of the page.
 */
function Formula({ tex, display }: { tex: string; display: boolean }) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		katex.render(tex, node, { displayMode: display, throwOnError: false, trust: false, strict: false });
	}, [tex, display]);

	return <span className={display ? "mathDisplay" : "mathInline"} ref={ref} />;
}

/**
 * Whether `relPath` names a file this window's own file browser could show, and if not yet
 * known, which directory listing would settle the next step of that question.
 *
 * Walks the path one segment at a time against `tree` — the same cache `Files.tsx` fills as
 * directories are opened, keyed by the `state.files.tree` this component shares with it — so
 * a path already browsed resolves instantly from what is already known, and a path nobody
 * has opened yet resolves the moment its own ancestors are asked for. `"pending:<dir>"` is
 * the caller's cue to ask for that one directory; everything else is a final answer.
 *
 * `.` segments are skipped and a bare `..` refuses outright — a citation is never written
 * with a leading `./`, but nothing stops one, and `..` is this function's whole reason to
 * exist: without it, a workspace that happens to hold a directory with the same first name
 * as some unrelated ancestor path would open the wrong file. The real containment guarantee
 * is still `resolveInside` on the server, which this only anticipates for the sake of not
 * drawing a link that the read behind it would refuse anyway.
 */
function resolveInWorkspace(tree: State["files"]["tree"], relPath: string): "yes" | "no" | `pending:${string}` {
	const segments = relPath.split("/").filter((segment) => segment !== "." && segment !== "");
	if (segments.length === 0 || segments.includes("..")) return "no";

	let dir = "";
	for (let i = 0; i < segments.length; i += 1) {
		const entries = tree[dir];
		if (entries === undefined) return `pending:${dir}`;
		const entry = entries.find((candidate) => candidate.name === segments[i]);
		if (!entry) return "no";
		const last = i === segments.length - 1;
		if (last) return entry.kind === "file" ? "yes" : "no";
		if (entry.kind !== "dir") return "no";
		dir = dir ? `${dir}/${segments[i]}` : segments[i];
	}
	return "no";
}

/**
 * A place in the repository, made usable.
 *
 * Every agent here is told to quote `path:line` for anything specific, so this is the most
 * valuable thing in the answer, and it read as ordinary grey prose.
 *
 * Two behaviors live here, not one. A path that resolves inside this conversation's own
 * directory — something `save` wrote, or a compute artifact pulled back into it — opens in
 * the file browser (see `resolveInWorkspace`, and `opener` above for what reaching it took).
 * Anything else, including a path quoted from the codebase an agent was pointed at, cannot
 * be opened here at all: `Files.tsx`'s server side only ever reads inside the conversation's
 * own directory, never the material the agents were asked about. That path falls back to the
 * copy behavior this whole component used to have unconditionally: opening an editor by
 * guessing a URL scheme (`vscode:`, `cursor:`, ...) risks the wrong one, which is a link that
 * silently does nothing, and a path on the clipboard works in every editor's quick-open.
 *
 * The two must also look different, not just behave differently — a citation styled like a
 * working link that only copies is exactly the complaint that put this split here. `.ref` is
 * unstyled prose until resolution says otherwise: `.ref.open` earns the solid, colored
 * underline a real link gets; everything else keeps the dim, dashed one that says "copy",
 * including the ordinary case where resolution has not finished yet.
 */
function Ref({ node, base, opener }: { node: Extract<Inline, { kind: "ref" }>; base?: string; opener?: Opener }) {
	const [copied, setCopied] = useState(false);
	const full = node.line === undefined ? node.path : `${node.path}:${node.line}`;

	const resolution = opener ? resolveInWorkspace(opener.state.files.tree, node.path) : "no";
	const openable = resolution === "yes";

	// Ask for whatever directory listing the walk above stopped on, so the next render — the
	// one after `files.tree` carries the answer — can take the next step or settle.
	//
	// The dependency list names `opener`'s stable pieces rather than `opener` itself on
	// purpose: `opener.state` is a fresh object every time anything in the run changes, which
	// while a message is streaming in is many times a second, and depending on the object
	// itself would re-fire this effect, and re-send the same `files.list`, on every one of
	// those — for a directory this same effect already asked about on an earlier render.
	// `send` is stable (see `main.tsx`'s `useCallback`), `connected` is a primitive, and
	// `resolution` is a string that only actually changes value when the walk below made
	// real progress, so together they fire this exactly when there is new ground to cover.
	useEffect(() => {
		if (!opener || !opener.state.connected) return;
		if (!resolution.startsWith("pending:")) return;
		opener.send({ type: "files.list", path: resolution.slice("pending:".length) });
	}, [opener?.send, opener?.state.connected, resolution]);

	return (
		<button
			type="button"
			className={`ref ${openable ? "open" : ""} ${copied ? "copied" : ""}`}
			title={openable ? `open ${full}` : base ? `${base}/${full} — click to copy` : "click to copy"}
			onClick={() => {
				if (openable && opener) {
					opener.onRevealFiles();
					opener.send({ type: "files.read", path: node.path });
					return;
				}
				navigator.clipboard.writeText(full).then(
					() => setCopied(true),
					() => setCopied(false),
				);
				window.setTimeout(() => setCopied(false), 1200);
			}}
		>
			{node.text}
		</button>
	);
}
