import type { StepRow } from '@lumen/contracts';
import type { Worker, WorkerReport } from '../../core/domain/worker.js';
import { ModelError, withLog, type ModelProvider } from '../../core/model/index.js';

// A worker with no model and no sandbox. It plays the shape of a real run so
// that the whole path can be seen and tested before the steering slice supplies
// the agent loop behind the same interface: a lead that thinks, searches, fans
// the question out to readers and answers; readers that search, run something,
// keep a finding and reply. Nothing here starts a process, and every line it
// writes says so. The durations are measured, not invented: they are how long
// the demo waited. Given a ModelProvider, the lead's thinking and reply come
// from a real model, and what that cost goes through the step into the ledger:
// the one path money takes, proven end to end before the agent loop lands.

const PARTS = ['what is already known', 'what changed recently', 'what is still open'] as const;
const SEARCH_COST = { dollars: 0.01 };

export interface DemoOptions {
  /**
   * How long each step pretends to work, in ms. Zero for tests. A person
   * watching the page needs a moment between steps to see that it is live.
   */
  readonly paceMs?: number;
  /**
   * A model for the lead to think and reply with. Left out, the lead says its
   * fixed lines. The readers never call it: their part is the fan-out.
   */
  readonly model?: ModelProvider;
}

/** The most a lead may spend on one answer. A demo never runs up a bill. */
const MAX_ANSWER_TOKENS = 200;

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
  const model = options.model;

  /**
   * One line from the model, written as a step of the given kind, with what
   * it cost on the step. A model that fails is a line that says so, at no
   * cost: the demo goes on, because the fan-out is what it is here to show.
   */
  async function ask(
    report: WorkerReport,
    taskId: string,
    kind: 'thinking' | 'reply',
    system: string,
    prompt: string,
  ): Promise<void> {
    if (!model) return;
    try {
      const reply = await withLog(model, report.log).complete({
        system,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: MAX_ANSWER_TOKENS,
      });
      await report.appendStep(taskId, kind, reply.text || '(the model said nothing)', {
        tool: model.name,
        durationMs: reply.durationMs,
        cost: reply.cost,
      });
    } catch (error) {
      const why = error instanceof ModelError ? `${error.kind}: ${error.message}` : String(error);
      await report.appendStep(taskId, kind, `The model did not answer (${why}).`);
    }
  }

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
      // A later turn arrives with the conversation before it (kernel `say`);
      // the scripted demo works on the new message only.
      const said = firstTurn ? input : (input.split('\nThe user now says: ').pop() ?? input);
      const parts = firstTurn
        ? PARTS.map((part) => ({ agent: 'reader', title: `${part}: ${input}` }))
        : [{ agent: 'reader', title: said }];

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
      if (model) {
        await ask(
          report,
          task.id,
          'thinking',
          'You lead a small research team. In two sentences, say what must be checked first and why. Plain words, no list.',
          firstTurn ? `The question is: ${input}` : input,
        );
      } else {
        await report.appendStep(
          task.id,
          'thinking',
          firstTurn
            ? `Before anything else, find out what is already known about "${input}": a result that is rediscovered is worth nothing. Then split it ${parts.length} ways.`
            : `"${said}" is one line of enquiry. One reader.`,
        );
      }
      // delegate() writes the delegate step itself, naming the tasks it opened.
      const children = await report.delegate(task.id, parts);
      const ended = children.filter((child) => child.status === 'ended').length;
      if (model) {
        await ask(
          report,
          task.id,
          'reply',
          'You lead a small research team. Your readers have reported. In two sentences, tell the user what was found and what you would do next. Be honest that the readers are a demo and found nothing real.',
          `Question: ${said}. ${ended} of ${children.length} readers finished; each recorded one demo finding.`,
        );
      } else {
        await report.appendStep(
          task.id,
          'reply',
          `${ended} of ${children.length} readers finished. No model is wired in yet, so there is nothing to conclude.`,
        );
      }
    },
  };
}
