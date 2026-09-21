import { describe, expect, it } from 'vitest';
import type { Task } from '@lumen/contracts';
import { atFoot, childrenByStep, elapsed, took, toolLabel, treeRows, turnToSend } from './tree';

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
  const kids = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const ids = (list: readonly { id: string }[] | undefined): string[] =>
    (list ?? []).map((k) => k.id);

  it('takes the children a step names, in the order it names them', () => {
    const byStep = childrenByStep(
      [
        { index: 1, text: 'delegated 3 in parallel', detail: { childTaskIds: ['c', 'a', 'b'] } },
        { index: 5, text: 'delegated 1 in parallel', detail: { childTaskIds: ['d'] } },
      ],
      kids,
    );

    expect(ids(byStep.get(1))).toEqual(['c', 'a', 'b']);
    expect(ids(byStep.get(5))).toEqual(['d']);
  });

  it('for a step recorded before steps named their children, takes the next N by order', () => {
    const byStep = childrenByStep(
      [
        { index: 1, text: 'delegated 3 in parallel' },
        { index: 5, text: 'delegated 1 in parallel' },
      ],
      kids,
    );

    expect(ids(byStep.get(1))).toEqual(['a', 'b', 'c']);
    expect(ids(byStep.get(5))).toEqual(['d']);
  });

  it('never gives an old step a child that a newer step names', () => {
    const byStep = childrenByStep(
      [
        { index: 1, text: 'delegated 2 in parallel' },
        { index: 5, text: 'delegated 2 in parallel', detail: { childTaskIds: ['b', 'd'] } },
      ],
      kids,
    );

    expect(ids(byStep.get(1))).toEqual(['a', 'c']);
    expect(ids(byStep.get(5))).toEqual(['b', 'd']);
  });

  it('ignores a named child that is not in the tree, and gives a numberless step what is left', () => {
    expect(
      ids(
        childrenByStep([{ index: 0, text: 'x', detail: { childTaskIds: ['zz', 'a'] } }], kids).get(
          0,
        ),
      ),
    ).toEqual(['a']);
    expect(ids(childrenByStep([{ index: 0, text: 'handed down' }], kids).get(0))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('session page: how long a step took', () => {
  it('writes it the way the spec does', () => {
    expect(took(0)).toBe('0 ms');
    expect(took(412)).toBe('412 ms');
    expect(took(6_000)).toBe('6 s');
    expect(took(8_940)).toBe('8.9 s');
    expect(took(161_000)).toBe('2 min 41 s');
    // The edge of a unit, and what is not a duration at all.
    expect(took(999.6)).toBe('1 s');
    expect(took(9_960)).toBe('10 s');
    expect(took(Number.NaN)).toBe('0 ms');
    expect(elapsed(Number.NaN)).toBe('0 s');
  });
});

describe('session page: what the composer sends', () => {
  it('sends the trimmed text, and nothing for an empty line', () => {
    expect(turnToSend('  push it to n = 11 ', false)).toBe('push it to n = 11');
    expect(turnToSend('   ', false)).toBeNull();
    expect(turnToSend(null, false)).toBeNull();
  });

  it('sends nothing while a run is going or the socket is down, whatever key was pressed', () => {
    // Enter submits a form that has no submit button, and while a run is going
    // the only button is Stop. A turn said then started a second run on the lead.
    expect(turnToSend('a second turn', true)).toBeNull();
  });
});

describe('session page: when a new step pulls the stream down', () => {
  it('follows a reader at the foot, and leaves one who scrolled up', () => {
    expect(atFoot({ scrollHeight: 1200, scrollTop: 600, clientHeight: 600 })).toBe(true);
    expect(atFoot({ scrollHeight: 1200, scrollTop: 560, clientHeight: 600 })).toBe(true);
    expect(atFoot({ scrollHeight: 1200, scrollTop: 300, clientHeight: 600 })).toBe(false);
  });
});
