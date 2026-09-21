import { describe, expect, it } from 'vitest';
import type { Task } from '@lumen/contracts';
import { childrenByStep, elapsed, toolLabel, treeRows } from './tree';

const task = (id: string, parentId: string | null): Task => ({
  id,
  sessionId: 's',
  parentId,
  agent: id,
  title: '',
  depth: 0,
  status: 'ended',
  ownCost: { dollars: 0 },
  startedAt: 0,
  endedAt: 0,
});

describe('session page: the call tree as rows', () => {
  it('draws each branch, closes the last child, and carries the trunk past open ones', () => {
    const rows = treeRows([
      task('lead', null),
      task('reader', 'lead'),
      task('nested', 'reader'),
      task('compute', 'lead'),
    ]);

    expect(rows.map((row) => `${row.branch}${row.task.id}`)).toEqual([
      'lead',
      '├ reader',
      '│ └ nested',
      '└ compute',
    ]);
  });

  it('keeps the order the tasks were opened in, whatever order they arrive in', () => {
    const rows = treeRows([task('b', 'lead'), task('lead', null), task('a', 'lead')]);
    expect(rows.map((row) => row.task.id)).toEqual(['lead', 'b', 'a']);
  });
});

describe('session page: small formats', () => {
  it('says how long in the two largest units', () => {
    expect(elapsed(2_400)).toBe('2 s');
    expect(elapsed(161_000)).toBe('2 min 41 s');
    expect(elapsed(8_040_000)).toBe('2 h 14 min');
    expect(elapsed(-5)).toBe('0 s');
  });

  it('takes the tool name from the front of a tool step', () => {
    expect(toolLabel('search: "fusion" (demo)')).toEqual({
      label: 'search',
      body: '"fusion" (demo)',
    });
    expect(toolLabel('Just text: with a colon')).toEqual({
      label: 'tool',
      body: 'Just text: with a colon',
    });
  });
});

describe('session page: which children a delegate step handed down', () => {
  it('gives each delegate step its own children, in order, and not the whole list', () => {
    const byStep = childrenByStep(
      [
        { index: 1, text: 'delegated 3 in parallel' },
        { index: 5, text: 'delegated 1 in parallel' },
      ],
      ['a', 'b', 'c', 'd'],
    );

    expect(byStep.get(1)).toEqual(['a', 'b', 'c']);
    expect(byStep.get(5)).toEqual(['d']);
  });

  it('gives a step that names no number whatever is left', () => {
    expect(childrenByStep([{ index: 0, text: 'handed down' }], ['a', 'b']).get(0)).toEqual([
      'a',
      'b',
    ]);
  });
});
