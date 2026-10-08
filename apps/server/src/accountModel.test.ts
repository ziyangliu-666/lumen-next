import { expect, it, vi } from 'vitest';
import { accountModel } from './accountModel.js';
import { makeTask } from './core/domain/task.js';
import type { WorkerReport } from './core/domain/worker.js';
import { nullLog } from './core/log/log.js';
import { nullModel } from './core/model/index.js';

const report: WorkerReport = {
  log: nullLog,
  appendStep: () => Promise.resolve(),
  delegate: () => Promise.resolve([]),
  recordFinding: () => Promise.reject(new Error('unused')),
  addSpend: () => Promise.resolve(),
};
const request = { system: '', messages: [], maxTokens: 1 };
const task = (id: string): ReturnType<typeof makeTask> => makeTask(id, id, null, 'lead', 'test', 0);

it('isolates parallel account contexts and rereads each call without caching plaintext', async () => {
  const saved = new Map([
    ['one', 'key-one'],
    ['two', 'key-two'],
  ]);
  const seen: string[] = [];
  const layer = accountModel(
    nullModel,
    async (id) => {
      await Promise.resolve();
      return saved.get(id) ?? null;
    },
    (key) => ({
      ...nullModel,
      complete: (input) => {
        seen.push(key);
        return nullModel.complete(input);
      },
    }),
  );
  const worker = layer.wrap(
    {
      run: async (_task, id) => {
        await layer.model.complete(request);
        saved.set(id, `${id}-replacement`);
        await layer.model.complete(request);
      },
    },
    (id) => Promise.resolve(id),
  );
  await Promise.all(['one', 'two'].map((id) => worker.run(task(id), id, report)));
  expect(seen.sort()).toEqual(['key-one', 'key-two', 'one-replacement', 'two-replacement'].sort());
  await expect(layer.model.complete(request)).rejects.toThrow('model account context unavailable');
});

it('uses fallback only for absence and propagates failures without a provider call', async () => {
  const fallback = vi.fn<typeof nullModel.complete>((request, signal) =>
    nullModel.complete(request, signal),
  );
  const provider = vi.fn(() => nullModel);
  const failure = new Error('unavailable');
  const secret = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
  const layer = accountModel({ ...nullModel, complete: fallback }, secret, provider);
  const worker = layer.wrap(
    {
      run: async () => {
        await layer.model.complete(request);
      },
    },
    (id) => Promise.resolve(id),
  );
  await worker.run(task('one'), '', report);
  expect(fallback).toHaveBeenCalledOnce();
  secret.mockRejectedValue(failure);
  await expect(worker.run(task('one'), '', report)).rejects.toBe(failure);
  expect(fallback).toHaveBeenCalledOnce();
  expect(provider).not.toHaveBeenCalled();
  const missing = layer.wrap({ run: vi.fn() }, () => Promise.resolve(null));
  await expect(missing.run(task('missing'), '', report)).rejects.toThrow(
    'model account context unavailable',
  );
});
