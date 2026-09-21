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
 * Which children each delegate step handed down. A step names them in
 * `detail.childTaskIds`, and that is the answer. A step recorded before the
 * contract had that field names nobody; it says how many, and both the steps
 * and the children are in the order they happened, so it takes the next N
 * children that no step has named. A step that gives no number takes what is
 * left.
 */
export function childrenByStep<T extends { readonly id: string }>(
  delegateSteps: readonly {
    readonly index: number;
    readonly text: string;
    readonly detail?: { readonly childTaskIds?: readonly string[] };
  }[],
  children: readonly T[],
): Map<number, readonly T[]> {
  const named = new Set(delegateSteps.flatMap((step) => step.detail?.childTaskIds ?? []));
  const unnamed = children.filter((child) => !named.has(child.id));
  const result = new Map<number, readonly T[]>();
  let next = 0;
  for (const step of delegateSteps) {
    const ids = step.detail?.childTaskIds;
    if (ids) {
      result.set(
        step.index,
        ids.flatMap((id) => children.filter((child) => child.id === id)),
      );
      continue;
    }
    const count = Number(/\b(\d+)\b/.exec(step.text)?.[1] ?? unnamed.length - next);
    result.set(step.index, unnamed.slice(next, next + count));
    next += count;
  }
  return result;
}

/** A step's duration as the spec writes it: '6 s', '8.9 s', '2 min 41 s'. Sub-second shows as ms. */
export function took(durationMs: number): string {
  if (durationMs < 1000) return `${Math.max(0, Math.round(durationMs))} ms`;
  if (durationMs < 10_000) return `${(durationMs / 1000).toFixed(1).replace(/\.0$/, '')} s`;
  return elapsed(durationMs);
}
