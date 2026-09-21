import type { StepRow } from '@lumen/contracts';
import type { Worker, WorkerReport } from '../../core/domain/worker.js';

// A worker with no model and no sandbox. It plays the shape of a real run so
// that the whole path can be seen and tested before the steering slice supplies
// the agent loop behind the same interface: a lead that thinks, searches, fans
// the question out to readers and answers; readers that search, run something,
// keep a finding and reply. Nothing here reaches a network or starts a process,
// and every line it writes says so. The durations are measured, not invented:
// they are how long the demo waited.

const PARTS = ['what is already known', 'what changed recently', 'what is still open'] as const;
const SEARCH_COST = { dollars: 0.01 };

export interface DemoOptions {
  /**
   * How long each step pretends to work, in ms. Zero for tests. A person
   * watching the page needs a moment between steps to see that it is live.
   */
  readonly paceMs?: number;
}

/** How long a step pretends to work when nothing says otherwise: slow enough to watch. */
export const DEFAULT_PACE_MS = 900;

/**
 * The pace from LUMEN_DEMO_PACE_MS. Digits only: Number() would also take
 * '1e3', '0x10' and ' ', and a misspelt setting should say so at startup.
 */
export function paceFromEnv(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_PACE_MS;
  if (!/^\d{1,5}$/.test(raw) || Number(raw) > 10_000) {
    throw new Error(`LUMEN_DEMO_PACE_MS must be a whole number from 0 to 10000, got "${raw}"`);
  }
  return Number(raw);
}

export function demoWorker(options: DemoOptions = {}): Worker {
  const paceMs = options.paceMs ?? 0;

  /** Wait as a tool would, and say how long it took. */
  async function work(): Promise<number> {
    const startedAt = Date.now();
    if (paceMs > 0) await new Promise((done) => setTimeout(done, paceMs));
    return Date.now() - startedAt;
  }

  async function search(
    report: WorkerReport,
    taskId: string,
    rows: readonly StepRow[],
    cost?: { dollars: number },
  ): Promise<void> {
    const durationMs = await work();
    await report.appendStep(taskId, 'tool', 'search: demo, no network', {
      tool: 'search',
      durationMs,
      rows,
      ...(cost ? { cost } : {}),
    });
  }

  return {
    async run(task, input, report) {
      if (task.agent !== 'lead') {
        await search(
          report,
          task.id,
          [
            { source: 'demo', text: 'everything on it', result: '3 sources' },
            { source: 'demo', text: 'the last 6 months', result: 'nothing', empty: true },
          ],
          SEARCH_COST,
        );
        const durationMs = await work();
        await report.appendStep(task.id, 'tool', 'run: tally the sources (demo, no process)', {
          tool: 'run',
          durationMs,
          output: [
            '$ demo tally --sources 3',
            '3 sources read   0 contradictions',
            'no model is wired in: these lines are fixed',
          ].join('\n'),
        });
        await report.recordFinding(
          task.id,
          `Demo finding for "${task.title}". No model wrote this.`,
        );
        await report.appendStep(task.id, 'reply', `Recorded one finding for "${task.title}".`);
        return;
      }

      // The first turn of a root is its question. A later turn is the user
      // speaking again, and gets one reader rather than the whole fan-out.
      const firstTurn = input === task.title;
      const parts = firstTurn
        ? PARTS.map((part) => ({ agent: 'reader', title: `${part}: ${input}` }))
        : [{ agent: 'reader', title: input }];

      // A later turn thinks for a moment. The first one goes straight to its
      // search, which waits for itself: two waits in a row showed a person
      // "Nothing yet." for twice the pace on their first visit.
      if (!firstTurn) await work();
      if (firstTurn) {
        // The lead looks before it delegates, as the spec's does, so the stream
        // a person lands on shows a tool block. It is free: only the readers
        // spend, which keeps a first turn at three cents.
        await search(report, task.id, [
          { source: 'demo', text: 'is it already known', result: 'partly' },
          { source: 'demo', text: 'is it named', result: 'no recurrence' },
          { source: 'demo', text: 'has anybody written it up', result: 'nothing', empty: true },
        ]);
      }
      await report.appendStep(
        task.id,
        'thinking',
        firstTurn
          ? `Before anything else, find out what is already known about "${input}": a result that is rediscovered is worth nothing. Then split it ${parts.length} ways.`
          : `"${input}" is one line of enquiry. One reader.`,
      );
      // delegate() writes the delegate step itself, naming the tasks it opened.
      const children = await report.delegate(task.id, parts);
      const ended = children.filter((child) => child.status === 'ended').length;
      await report.appendStep(
        task.id,
        'reply',
        `${ended} of ${children.length} readers finished. No model is wired in yet, so there is nothing to conclude.`,
      );
    },
  };
}
