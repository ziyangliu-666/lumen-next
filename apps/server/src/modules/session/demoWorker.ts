import type { Worker } from '../../core/domain/worker.js';

// A worker with no model and no sandbox. It plays the shape of a real run so
// that the whole path can be seen and tested before the steering slice supplies
// the agent loop behind the same interface: a lead that thinks, fans the
// question out to readers, and answers; readers that each use a tool, spend
// something and reply. Every figure it reports is made up and says so.
const PARTS = ['what is already known', 'what changed recently', 'what is still open'] as const;
const SEARCH_COST = { dollars: 0.01 };

export const demoWorker: Worker = {
  async run(task, input, report) {
    if (task.agent !== 'lead') {
      await report.appendStep(task.id, 'tool', `search: "${task.title}" (demo, no network)`);
      await report.addSpend(task.id, SEARCH_COST, 'search');
      await report.appendStep(task.id, 'reply', `Nothing found for "${task.title}": no model yet.`);
      return;
    }

    // The first turn of a root is its question. A later turn is the user
    // speaking again, and gets one reader rather than the whole fan-out.
    const firstTurn = input === task.title;
    const work = firstTurn
      ? PARTS.map((part) => ({ agent: 'reader', title: `${part}: ${input}` }))
      : [{ agent: 'reader', title: input }];

    await report.appendStep(task.id, 'thinking', `Splitting "${input}" into ${work.length}.`);
    await report.appendStep(task.id, 'delegate', `delegated ${work.length} in parallel`);
    const children = await report.delegate(task.id, work);
    const ended = children.filter((child) => child.status === 'ended').length;
    await report.appendStep(
      task.id,
      'reply',
      `${ended} of ${children.length} readers finished. No model is wired in yet.`,
    );
  },
};
