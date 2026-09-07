import { describe, expect, it } from 'vitest';
import { makePoint, rollableCost } from './point.js';

describe('core: point record', () => {
  it('opens idle, with no cost and no children', () => {
    const p = makePoint('p1', 'line-1', null, null);
    expect(p.status).toBe('idle');
    expect(p.ownCost).toEqual({ cents: 0 });
    expect(p.childIds).toEqual([]);
  });

  it('keeps the edge it was opened through', () => {
    const p = makePoint('p2', 'line-1', 'p1', 'delegate');
    expect(p.parentId).toBe('p1');
    expect(p.edgeFromParent).toBe('delegate');
  });

  it('adds its own cost to whatever its children rolled up', () => {
    const p = { ...makePoint('p1', 'line-1', null, null), ownCost: { cents: 10 } };
    expect(rollableCost(p, { cents: 25 })).toEqual({ cents: 35 });
  });
});
