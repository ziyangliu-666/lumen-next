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
 */

import { useState } from "react";
import { parse, type Block, type Inline } from "./markdown.ts";

export function Prose({ text, base }: { text: string; base?: string }) {
	return (
		<div className="prose">
			{parse(text).map((block, index) => (
				<Blocks key={index} block={block} base={base} />
			))}
		</div>
	);
}

function Blocks({ block, base }: { block: Block; base?: string }) {
	switch (block.kind) {
		case "para":
			return (
				<p>
					<Inlines nodes={block.children} base={base} />
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
					<Inlines nodes={block.children} base={base} />
				</Tag>
			);
		}
		case "list": {
			const Tag = block.ordered ? "ol" : "ul";
			return (
				<Tag>
					{block.items.map((item, index) => (
						<li key={index}>
							<Inlines nodes={item} base={base} />
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
						<Blocks key={index} block={child} base={base} />
					))}
				</blockquote>
			);
		case "rule":
			return <hr />;
	}
}

function Inlines({ nodes, base }: { nodes: Inline[]; base?: string }) {
	return (
		<>
			{nodes.map((node, index) => (
				<One key={index} node={node} base={base} />
			))}
		</>
	);
}

function One({ node, base }: { node: Inline; base?: string }) {
	switch (node.kind) {
		case "text":
			return <>{node.text}</>;
		case "code":
			return <code>{node.text}</code>;
		case "strong":
			return (
				<strong>
					<Inlines nodes={node.children} base={base} />
				</strong>
			);
		case "em":
			return (
				<em>
					<Inlines nodes={node.children} base={base} />
				</em>
			);
		case "link":
			// `noreferrer` as well as `noopener`: the pages an agent cites are pages nobody
			// vetted, and there is no reason to tell one of them where the reader came from.
			return (
				<a href={node.href} target="_blank" rel="noreferrer noopener">
					<Inlines nodes={node.children} base={base} />
				</a>
			);
		case "ref":
			return <Ref node={node} base={base} />;
	}
}

/**
 * A place in the repository, made usable.
 *
 * Every agent here is told to quote `path:line` for anything specific, so this is the most
 * valuable thing in the answer, and it read as ordinary grey prose.
 *
 * Clicking copies rather than opening an editor. Opening one means guessing which — the
 * `vscode:` and `cursor:` schemes are not interchangeable, and a link to the wrong one is a
 * link that silently does nothing. A path on the clipboard works in every editor's
 * quick-open, and it is what a person does with one of these anyway.
 */
function Ref({ node, base }: { node: Extract<Inline, { kind: "ref" }>; base?: string }) {
	const [copied, setCopied] = useState(false);
	const full = node.line === undefined ? node.path : `${node.path}:${node.line}`;
	return (
		<button
			type="button"
			className={`ref ${copied ? "copied" : ""}`}
			title={base ? `${base}/${full} — click to copy` : "click to copy"}
			onClick={() => {
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
