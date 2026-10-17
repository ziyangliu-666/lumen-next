import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import Markdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

// A model's reply, drawn as the Markdown it is written in: GitHub tables and
// lists, LaTeX ($…$ and $$…$$, by KaTeX), fenced code, Mermaid diagrams,
// links, and images of the project's own files. A hand-made renderer drew
// paragraphs, lists and headings only, so formulas showed as dollar signs and
// a diagram as its source.
//
// What a model writes never reaches the page as HTML: raw HTML in a reply is
// not parsed (react-markdown without rehype-raw). Links open in a new tab and
// only over http(s). An image is shown only when it is a file of this project
// (/mnt/output, /mnt/workspace, /mnt/upload); any other address stays a link,
// so a reply cannot make the page load from a site of its choosing.
//
// OEIS A-numbers and arXiv ids in the text are links to the entry, drawn as
// small chips beside the sentence that cites them.

/** Turns a /mnt path the agents wrote into the files route of this project, or null. */
export type FileLink = (virtualPath: string) => string | null;

const FileLinks = createContext<FileLink>(() => null);

export function ReplyFiles({
  link,
  children,
}: {
  link: FileLink;
  children: ReactNode;
}): JSX.Element {
  return <FileLinks.Provider value={link}>{children}</FileLinks.Provider>;
}

// The citations, as a remark step: text outside links and code is split where
// an A-number or an arXiv id stands, and those parts become links.
const CITATION =
  /\b(A\d{6})\b|\barXiv:\s?((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?)/g;

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, string> };
}

function split(text: string): MdNode[] {
  const parts: MdNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const at = match.index;
    const [whole, oeis, arxiv] = match;
    if (at > last) parts.push({ type: 'text', value: text.slice(last, at) });
    parts.push({
      type: 'link',
      url: oeis ? `https://oeis.org/${oeis}` : `https://arxiv.org/abs/${arxiv ?? ''}`,
      data: { hProperties: { 'data-cite': oeis ? 'oeis' : 'arxiv' } },
      children: [{ type: 'text', value: whole }],
    });
    last = at + whole.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

function walk(node: MdNode): void {
  if (!node.children || node.type === 'link' || node.type === 'inlineCode') return;
  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && child.value) return split(child.value);
    walk(child);
    return [child];
  });
}

function citations(): (tree: MdNode) => void {
  return walk;
}

/** An address a reply may link to: http(s), or this site's own path. */
function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return undefined;
}

function Mermaid({ code }: { code: string }): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    // Loaded only when a reply has a diagram: it is the largest part of the page.
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
          fontFamily: 'inherit',
        });
        const drawn = await mermaid.render(`mermaid-${id}`, code);
        if (active) setSvg(drawn.svg);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [code, id]);
  if (svg) {
    return (
      // Mermaid's own output under securityLevel 'strict': labels are text,
      // and no script or link from the source survives into the SVG.
      <div
        role="img"
        aria-label="Diagram"
        className="overflow-x-auto border border-rule-minor bg-paper p-4"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <pre className="overflow-x-auto border border-rule-minor bg-paper p-4 font-mono text-xs whitespace-pre text-ink">
      {failed ? `The diagram could not be drawn.\n\n${code}` : code}
    </pre>
  );
}

function ReplyImage({ src, alt }: { src: string | undefined; alt: string }): JSX.Element {
  const link = useContext(FileLinks);
  const local = src && /^\/mnt\/(output|workspace|upload)\//.test(src) ? link(src) : null;
  if (local) {
    return (
      <a href={local} target="_blank" rel="noreferrer" className="block">
        <img
          src={local}
          alt={alt}
          loading="lazy"
          className="max-h-[28rem] max-w-full border border-rule-minor"
        />
      </a>
    );
  }
  // A file path with no project to serve it is only its caption.
  const href = src?.startsWith('/mnt/') ? undefined : safeHref(src);
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="underline">
      {alt || 'Image'}
    </a>
  ) : (
    <span>{alt}</span>
  );
}

/** The text of a code element, which react-markdown hands over as strings. */
function plain(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map((child: ReactNode) => plain(child)).join('');
  return '';
}

const CODE_BLOCK =
  'overflow-x-auto border border-rule-minor bg-paper p-4 font-mono text-xs whitespace-pre text-ink tabular-nums';

const COMPONENTS: Components = {
  h1: ({ children }) => <p className="font-semibold">{children}</p>,
  h2: ({ children }) => <p className="font-semibold">{children}</p>,
  h3: ({ children }) => <p className="font-semibold">{children}</p>,
  h4: ({ children }) => <p className="font-semibold">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-rule-major pl-4 text-ink-2">{children}</blockquote>
  ),
  hr: () => <hr className="border-rule-minor" />,
  a: ({ href, children, ...props }) => {
    const cite = (props as Record<string, unknown>)['data-cite'];
    const safe = safeHref(href);
    if (!safe) return <span>{children}</span>;
    return (
      <a
        href={safe}
        target="_blank"
        rel="noreferrer"
        data-cite={typeof cite === 'string' ? cite : undefined}
        className={
          cite
            ? 'mx-0.5 inline-block border border-rule-minor bg-well px-1.5 align-baseline font-mono text-[0.8em] text-ink hover:border-ink'
            : 'underline decoration-1 underline-offset-[0.15em]'
        }
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => (
    <ReplyImage src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} />
  ),
  table: ({ children }) => (
    <Table flush className="w-auto min-w-48 tabular-nums">
      {children}
    </Table>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell>{children}</TableCell>,
  // The block is drawn by `code`, which knows its language.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = plain(children);
    const language = /language-(\w+)/.exec(className ?? '')?.[1];
    // A fenced block has a language or spans lines; anything else is inline.
    if (!language && !text.includes('\n')) {
      return <code className="font-mono text-[0.9em]">{children}</code>;
    }
    if (language === 'mermaid') return <Mermaid code={text.trimEnd()} />;
    return <pre className={CODE_BLOCK}>{text.replace(/\n$/, '')}</pre>;
  },
};

/**
 * GitHub's rule is that a table starts after a blank line, and models often
 * write one straight under a sentence ("Result:\n| n | a(n) |"). The line is
 * added, outside fenced blocks, so the table is drawn as one.
 */
export function tablesApart(text: string): string {
  const lines = text.split('\n');
  let fenced = false;
  return lines
    .map((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      const previous = lines[i - 1] ?? '';
      const starts =
        !fenced && /^\s*\|/.test(line) && previous.trim() !== '' && !/^\s*\|/.test(previous);
      return starts ? `\n${line}` : line;
    })
    .join('\n');
}

/** A reply, drawn from its Markdown. */
export function ReplyText({ text }: { text: string }): JSX.Element {
  return (
    <div className="space-y-2 [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, citations]}
        rehypePlugins={[rehypeKatex]}
        components={COMPONENTS}
      >
        {tablesApart(text)}
      </Markdown>
    </div>
  );
}
