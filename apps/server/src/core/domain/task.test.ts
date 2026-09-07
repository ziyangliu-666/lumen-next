import { describe, expect, it } from 'vitest';
import { makeTask, rollableCost } from './task.js';

describe('core: task record', () => {
  it('opens queued, with no cost and no children', () => {
    const t = makeTask('t1', 's1', null, 'lead', 'find something new', 0);
    expect(t.status).toBe('queued');
    expect(t.ownCost).toEqual({ dollars: 0 });
    expect(t.childIds).toEqual([]);
    expect(t.endedAt).toBeNull();
  });

  it('keeps its parent and its depth', () => {
    const t = makeTask('t2', 's1', 't1', 'reader', 'what is already known', 1);
    expect(t.parentId).toBe('t1');
    expect(t.depth).toBe(1);
  });

  it('adds its own cost to whatever its children rolled up', () => {
    const t = { ...makeTask('t1', 's1', null, 'lead', '', 0), ownCost: { dollars: 0.1 } };
    expect(rollableCost(t, { dollars: 0.25 })).toEqual({ dollars: 0.35 });
  });
});
