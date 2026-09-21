import type { Task } from '@lumen/contracts';

// The plain parts of the Session page: no React, so `npm run verify` tests them.

export interface TreeRow {
  readonly task: Task;
  /** The box-drawing prefix that places the row: '', '├ ', '│ └ ' … */
  readonly branch: string;
}

/** The call tree as rows, parents before children, each with its branch glyphs. */
export function treeRows(tasks: readonly Task[]): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (parentId: string | null, trunk: string): void => {
    const children = tasks.filter((task) => task.parentId === parentId);
    children.forEach((task, index) => {
      const last = index === children.length - 1;
      const root = parentId === null;
      rows.push({ task, branch: root ? '' : `${trunk}${last ? '└' : '├'} ` });
      walk(task.id, root ? '' : `${trunk}${last ? ' ' : '│'} `);
    });
  };
  walk(null, '');
  return rows;
}

/** How long something took, in the two largest units: '3 s', '2 min 41 s', '2 h 14 min'. */
export function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * A tool step's text is 'name: what it did'. The name is the block's label.
 * Text with no such prefix is a tool step all the same; it just has no name.
 */
export function toolLabel(text: string): { readonly label: string; readonly body: string } {
  const match = /^([a-z][a-z0-9-]{1,20}):\s+(.*)$/s.exec(text);
  return match ? { label: match[1]!, body: match[2]! } : { label: 'tool', body: text };
}

/**
 * Which children each delegate step handed down. A step does not name them yet
 * (the contract's `childTaskIds` is the next change), but it says how many, and
 * both the steps and the children are in the order they happened: the first
 * delegate step takes the first N children, the next one the N after those.
 * A step that gives no number takes whatever is left.
 */
export function childrenByStep<T>(
  delegateSteps: readonly { readonly index: number; readonly text: string }[],
  children: readonly T[],
): Map<number, readonly T[]> {
  const result = new Map<number, readonly T[]>();
  let next = 0;
  for (const step of delegateSteps) {
    const count = Number(/\b(\d+)\b/.exec(step.text)?.[1] ?? children.length - next);
    result.set(step.index, children.slice(next, next + count));
    next += count;
  }
  return result;
}
