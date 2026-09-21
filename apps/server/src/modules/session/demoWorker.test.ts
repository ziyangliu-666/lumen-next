import { describe, expect, it } from 'vitest';
import type { StepDetail, StepKind } from '@lumen/contracts';
import { makeTask } from '../../core/domain/task.js';
import type { WorkerReport } from '../../core/domain/worker.js';
import { DEFAULT_PACE_MS, demoWorker, paceFromEnv } from './demoWorker.js';

/** A report that only records what the worker wrote. */
type Written = [StepKind, string, StepDetail | undefined];

function recording(): { report: WorkerReport; steps: Written[] } {
  const steps: Written[] = [];
  return {
    steps,
    report: {
      appendStep: (_taskId, kind, text, detail) => {
        steps.push([kind, text, detail]);
        return Promise.resolve();
      },
      delegate: () => Promise.resolve([]),
      addSpend: () => Promise.resolve(),
      recordFinding: (taskId, text) =>
        Promise.resolve({ id: 'f', sessionId: 's', taskId, text, createdAt: 0 }),
    },
  };
}

const reader = {
  ...makeTask('r1', 's1', 'lead', 'reader', 'part one', 1),
  status: 'running' as const,
};
const lead = { ...makeTask('lead', 's1', null, 'lead', 'question', 0), status: 'running' as const };

describe('session: the demo worker', () => {
  it('waits the pace it is given on each tool step, and reports the time it really took', async () => {
    const { report, steps } = recording();
    const startedAt = Date.now();

    await demoWorker({ paceMs: 40 }).run(reader, reader.title, report);

    const durations = steps.flatMap(([, , detail]) =>
      detail?.durationMs === undefined ? [] : [detail.durationMs],
    );
    expect(durations).toHaveLength(2);
    // Measured, not invented: each is at least the pace, and together they fit in the wall time.
    expect(durations.every((ms) => ms >= 35)).toBe(true);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(durations.reduce((a, b) => a + b, 0) - 5);
  });

  it('does not wait at all at pace 0, which is what every other test relies on', async () => {
    const { report, steps } = recording();
    await demoWorker().run(reader, reader.title, report);

    const durations = steps
      .map(([, , detail]) => detail?.durationMs)
      .filter((ms) => ms !== undefined);
    // Not exactly 0: the clock can turn over between the two reads.
    expect(durations).toHaveLength(2);
    expect(durations.every((ms) => ms <= 1)).toBe(true);
  });

  it('has the lead search for nothing, so a first turn costs what the three readers cost', async () => {
    const { report, steps } = recording();
    await demoWorker().run(lead, lead.title, report);

    const search = steps.find(([, , detail]) => detail?.tool === 'search');
    expect(search?.[2]?.rows?.some((row) => row.empty)).toBe(true);
    expect(search?.[2]).not.toHaveProperty('cost');
  });

  it("never writes a delegate step itself: that is the kernel's", async () => {
    const { report, steps } = recording();
    await demoWorker().run(lead, lead.title, report);

    expect(steps.map(([kind]) => kind)).not.toContain('delegate');
  });
});

describe('session: the demo pace from the environment', () => {
  it('defaults to a pace a person can watch, and takes whole milliseconds', () => {
    expect(paceFromEnv(undefined)).toBe(DEFAULT_PACE_MS);
    expect(paceFromEnv('')).toBe(DEFAULT_PACE_MS);
    expect(paceFromEnv('0')).toBe(0);
    expect(paceFromEnv('10000')).toBe(10_000);
  });

  it('refuses what Number() would quietly accept', () => {
    for (const raw of [' ', '1e3', '0x10', '-1', '1.5', '10001', 'fast']) {
      expect(() => paceFromEnv(raw), raw).toThrow(/LUMEN_DEMO_PACE_MS/);
    }
  });
});
