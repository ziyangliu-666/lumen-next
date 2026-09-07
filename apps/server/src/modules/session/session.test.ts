import { describe, expect, it } from 'vitest';
import { PointNode } from './index.js';

const c = (dollars: number): { dollars: number } => ({ dollars });

describe('session: Composite', () => {
  it('rolls delegated cost up but ignores branch and compact', () => {
    const lead = new PointNode('lead', c(10));
    lead.addChild('delegate', new PointNode('worker', c(30)));
    lead.addChild('branch', new PointNode('side', c(100)));
    lead.addChild('compact', new PointNode('cont', c(100)));
    expect(lead.cost()).toEqual({ dollars: 40 });
  });

  it('cancels the whole subtree', () => {
    const lead = new PointNode('lead', c(0));
    const worker = new PointNode('worker', c(0));
    lead.addChild('delegate', worker);
    lead.cancel();
    expect(worker.isCancelled()).toBe(true);
  });

  it('counts every point in the tree once', () => {
    const lead = new PointNode('lead', c(0));
    const w = new PointNode('w', c(0));
    w.addChild('delegate', new PointNode('ww', c(0)));
    lead.addChild('delegate', w);
    expect(lead.size()).toBe(3);
  });
});
