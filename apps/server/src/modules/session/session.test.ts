import { describe, expect, it } from 'vitest';
import type { Task } from '@lumen/contracts';
import { makeTask } from '../../core/domain/task.js';
import { buildTree, TaskNode } from './index.js';

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

  it('finds a task anywhere under it, so cost and cancel can start from any task', () => {
    const lead = new TaskNode('lead', d(1));
    const worker = new TaskNode('worker', d(2));
    worker.addChild(new TaskNode('nested', d(4)));
    lead.addChild(worker);

    expect(lead.find('worker')?.cost()).toEqual(d(6));
    expect(lead.find('nobody')).toBeNull();
  });

  it('is built from task rows, whatever order they arrive in', () => {
    const row = (id: string, parentId: string | null, dollars: number): Task => ({
      ...makeTask(id, 's1', parentId, 'a', '', parentId ? 1 : 0),
      ownCost: d(dollars),
    });
    const tree = buildTree([row('child', 'root', 0.02), row('root', null, 0.01)]);

    expect(tree?.id).toBe('root');
    expect(tree?.size()).toBe(2);
    expect(tree?.cost().dollars).toBeCloseTo(0.03, 6);
    expect(buildTree([])).toBeNull();
  });
});
