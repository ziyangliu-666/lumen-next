import type { JSX, ReactNode } from 'react';

// A model writes a little Markdown into a reply: a bold phrase, a list, a
// heading, a code span. This draws those and nothing else, as React nodes,
// so no string from a model ever reaches the page as HTML.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${key}-${i}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={`${key}-${i}`} className="font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const LIST_ITEM = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

/** The blocks of a reply: paragraphs, lists, headings, each with its inline marks. */
export function ReplyText({ text }: { text: string }): JSX.Element {
  const blocks: JSX.Element[] = [];
  let items: string[] = [];
  let paragraph: string[] = [];
  const flush = (): void => {
    if (items.length > 0) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5">
          {items.map((item, i) => (
            <li key={i}>{inline(item, `l${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      items = [];
    }
    if (paragraph.length > 0) {
      blocks.push(
        <p key={`p${blocks.length}`}>{inline(paragraph.join(' '), `p${blocks.length}`)}</p>,
      );
      paragraph = [];
    }
  };
  for (const line of text.split('\n')) {
    const heading = HEADING.exec(line);
    const item = LIST_ITEM.exec(line);
    if (line.trim() === '') flush();
    else if (heading) {
      flush();
      blocks.push(
        <p key={`h${blocks.length}`} className="font-semibold">
          {inline(heading[1] ?? '', `h${blocks.length}`)}
        </p>,
      );
    } else if (item) {
      if (paragraph.length > 0) flush();
      items.push(item[1] ?? '');
    } else {
      if (items.length > 0) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}
