import type { JSX, ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

// A model writes a little Markdown into a reply: a bold phrase, a list, a
// heading, a code span, a table, a fenced block. This draws those and nothing
// else, as React nodes, so no string from a model ever reaches the page as
// HTML. A table of terms came out as one line of pipes before tables were
// drawn, and a fenced script as one paragraph.

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
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const FENCE = /^\s*```/;

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Rows of pipes as a table; the first row is the head when a rule follows it. */
function ReplyTable({ rows, id }: { rows: readonly string[]; id: string }): JSX.Element {
  const headed = rows.length > 1 && TABLE_RULE.test(rows[1] ?? '');
  const head = headed ? cells(rows[0] ?? '') : null;
  const body = (headed ? rows.slice(2) : rows).map(cells);
  return (
    <Table flush className="w-auto min-w-48 tabular-nums">
      {head ? (
        <TableHeader>
          <TableRow>
            {head.map((cell, i) => (
              <TableHead key={i}>{inline(cell, `${id}-h${i}`)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
      ) : null}
      <TableBody>
        {body.map((row, r) => (
          <TableRow key={r}>
            {row.map((cell, i) => (
              <TableCell key={i}>{inline(cell, `${id}-${r}-${i}`)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The blocks of a reply: paragraphs, lists, headings, tables, fenced code, each with its inline marks. */
export function ReplyText({ text }: { text: string }): JSX.Element {
  const blocks: JSX.Element[] = [];
  let items: string[] = [];
  let paragraph: string[] = [];
  let table: string[] = [];
  let code: string[] | null = null;
  const flush = (): void => {
    if (table.length > 0) {
      blocks.push(<ReplyTable key={`t${blocks.length}`} id={`t${blocks.length}`} rows={table} />);
      table = [];
    }
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
  const flushCode = (lines: readonly string[]): void => {
    blocks.push(
      <pre
        key={`c${blocks.length}`}
        className="overflow-x-auto border border-rule-minor bg-paper p-4 font-mono text-xs whitespace-pre text-ink tabular-nums"
      >
        {lines.join('\n')}
      </pre>,
    );
  };
  for (const line of text.split('\n')) {
    if (code) {
      if (FENCE.test(line)) {
        flushCode(code);
        code = null;
      } else code.push(line);
      continue;
    }
    const heading = HEADING.exec(line);
    const item = LIST_ITEM.exec(line);
    const row = TABLE_ROW.test(line);
    // A row starts a table and any other line ends one.
    if (row !== table.length > 0) flush();
    if (FENCE.test(line)) {
      flush();
      code = [];
    } else if (row) table.push(line);
    else if (line.trim() === '') flush();
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
  // A reply cut off inside a fence still shows what it wrote.
  if (code) flushCode(code);
  flush();
  return <div className="space-y-2">{blocks}</div>;
}
