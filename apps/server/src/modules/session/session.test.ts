import { describe, expect, it } from 'vitest';
import { TaskNode } from './index.js';

const d = (dollars: number): { dollars: number } => ({ dollars });

describe('session: Composite', () => {
  it('rolls child cost up through the tree', () => {
    const lead = new TaskNode('lead', d(10));
    const worker = new TaskNode('worker', d(30));
    worker.addChild(new TaskNode('nested', d(5)));
    lead.addChild(worker);
    lead.addChild(new TaskNode('reader', d(1)));
    expect(lead.cost()).toEqual(d(46));
  });

  it('cancels the whole subtree', () => {
    const lead = new TaskNode('lead', d(0));
    const worker = new TaskNode('worker', d(0));
    lead.addChild(worker);
    lead.cancel();
    expect(worker.isCancelled()).toBe(true);
  });

  it('counts every task in the tree once', () => {
    const lead = new TaskNode('lead', d(0));
    const w = new TaskNode('w', d(0));
    w.addChild(new TaskNode('ww', d(0)));
    lead.addChild(w);
    expect(lead.size()).toBe(3);
  });
});
