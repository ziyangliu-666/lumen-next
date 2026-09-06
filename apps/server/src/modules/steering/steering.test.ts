import { describe, expect, it, vi } from 'vitest';
import { NullCompute, SteerCommand, SteerQueue } from './index.js';

describe('steering: Command', () => {
  it('applies a queued message only at the chosen moment', () => {
    const sink = vi.fn();
    const q = new SteerQueue();
    q.enqueue(new SteerCommand('push to n=11', 'next-step', sink));
    q.flush('end-of-turn');
    expect(sink).not.toHaveBeenCalled();
    q.flush('next-step');
    expect(sink).toHaveBeenCalledWith('push to n=11');
  });

  it('can undo the last command before it lands', () => {
    const sink = vi.fn();
    const q = new SteerQueue();
    q.enqueue(new SteerCommand('stop', 'end-of-turn', sink));
    q.cancelLast();
    q.flush('end-of-turn');
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('steering: Null Object compute', () => {
  it('returns a readable failure instead of a null', async () => {
    const r = await new NullCompute().run('ls');
    expect(r.exitCode).toBe(127);
    expect(r.stdout).toContain('No compute provider');
  });
});
