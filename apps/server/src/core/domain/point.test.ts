import { describe, expect, it } from 'vitest';
import { makePoint, rollableCost } from './point.js';

describe('core: point record', () => {
  it('opens queued, with no cost and no children', () => {
    const p = makePoint('p1', 'line-1', null, null);
    expect(p.status).toBe('queued');
    expect(p.ownCost).toEqual({ dollars: 0 });
    expect(p.childIds).toEqual([]);
  });

  it('keeps the edge it was opened through', () => {
    const p = makePoint('p2', 'line-1', 'p1', 'delegate');
    expect(p.parentId).toBe('p1');
    expect(p.edgeFromParent).toBe('delegate');
  });

  it('adds its own cost to whatever its children rolled up', () => {
    const p = { ...makePoint('p1', 'line-1', null, null), ownCost: { dollars: 0.1 } };
    expect(rollableCost(p, { dollars: 0.25 })).toEqual({ dollars: 0.35 });
  });
});
