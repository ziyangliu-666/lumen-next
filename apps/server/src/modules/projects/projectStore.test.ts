import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice } from '../session/index.js';
import { MemoryProjectStore } from './memoryProjectStore.js';
import { PgProjectStore } from './pgProjectStore.js';
import type { ProjectStore } from './ports.js';
import type { Finding, Project } from './models.js';

for (const database of [false, true]) {
  const suite = database ? describe.skipIf(!TEST_DATABASE_URL) : describe;
  suite(database ? 'PgProjectStore' : 'MemoryProjectStore', () => {
    let store: ProjectStore;
    let db: Db | undefined;
    let drop: (() => Promise<void>) | undefined;
    let sessionId: string;
    let taskId: string;
    beforeEach(async () => {
      if (database) {
        ({ db, drop } = await openTestDb());
        store = new PgProjectStore(db);
      } else store = new MemoryProjectStore();
      const sessions = createSessionSlice({
        broker: new Broker(),
        ...(db ? { db } : {}),
        worker: { run: () => Promise.resolve() },
      });
      const snapshot = await sessions.kernel.start(randomUUID(), 'alice', 'Research');
      sessionId = snapshot.session.id;
      taskId = snapshot.tasks[0]!.id;
      await sessions.kernel.idle();
    });
    afterEach(async () => {
      await drop?.();
      db = undefined;
      drop = undefined;
    });
    function project(accountId = 'alice', id = randomUUID()): Project {
      return {
        id,
        accountId,
        title: 'Research',
        mode: 'seed',
        createdAt: 1234567890000,
        lastOpenedAt: null,
        spendAtVisit: 0,
      };
    }
    function finding(text = 'Result', id = randomUUID()): Finding {
      return { id, sessionId, taskId, text, createdAt: 1234567890010 };
    }
    it('persists arbitrary stub owners, mode and exact timestamp without inserting accounts', async () => {
      const record = project();
      await store.insert(record);
      expect(await store.get(record.id)).toEqual(record);
      expect(await store.get(randomUUID())).toBeNull();
      if (db) expect(await new PgProjectStore(db).get(record.id)).toEqual(record);
    });
    it('removes an empty project but preserves projects with durable findings', async () => {
      const empty = project();
      await store.insert(empty);
      await store.remove(empty.id);
      expect(await store.get(empty.id)).toBeNull();
      const saved = project();
      await store.insert(saved);
      await store.saveFinding(saved.id, finding());
      await expect(store.remove(saved.id)).rejects.toThrow();
      expect(await store.get(saved.id)).toEqual(saved);
    });
    it('orders equal timestamps by ID and scopes every page by owner', async () => {
      const a = project('alice', '00000000-0000-4000-8000-000000000001');
      const b = project('alice', '00000000-0000-4000-8000-000000000002');
      await store.insert(a);
      await store.insert(b);
      await store.insert(project('bob'));
      expect(await store.list('alice', { limit: 1, after: null })).toEqual([b, a]);
      expect(await store.list('alice', { limit: 1, after: b })).toEqual([a]);
      expect(await store.list('alice', { limit: 1, after: a })).toEqual([]);
    });
    it('keeps findings after completion, provides chronological snapshots and project totals', async () => {
      const record = project();
      await store.insert(record);
      const a = finding('First', '00000000-0000-4000-8000-000000000001');
      const b = finding('Second', '00000000-0000-4000-8000-000000000002');
      await store.saveFinding(record.id, a);
      await store.saveFinding(record.id, b);
      expect(await store.sessionFindings(sessionId)).toEqual([a, b]);
      expect(await store.findings(record.id, { limit: 1, after: null })).toEqual([b, a]);
      expect(await store.findings(record.id, { limit: 1, after: b })).toEqual([a]);
      expect(await store.findingStats(record.id)).toEqual({
        count: 2,
        lastAt: a.createdAt,
        added: 2,
      });
      expect(await store.findingStats(randomUUID())).toEqual({ count: 0, lastAt: null, added: 0 });
    });
    it('does not overwrite existing project or finding identities', async () => {
      const record = project();
      await store.insert(record);
      await expect(store.insert({ ...record, title: 'Overwrite' })).rejects.toThrow();
      const result = finding();
      await store.saveFinding(record.id, result);
      await expect(
        store.saveFinding(record.id, { ...result, text: 'Overwrite' }),
      ).rejects.toThrow();
      expect(await store.get(record.id)).toEqual(record);
      expect(await store.sessionFindings(sessionId)).toEqual([result]);
    });
    it('does not attach findings to a nonexistent project', async () => {
      await expect(store.saveFinding(randomUUID(), finding())).rejects.toThrow();
    });
    it('persists an owner-scoped visit baseline and refuses older or foreign writes', async () => {
      const record = project();
      await store.insert(record);
      const at = record.createdAt + 20;
      expect(await store.visit(record.id, 'bob', at, 0.2)).toBeNull();
      await store.visit(record.id, 'alice', at, 0.2);
      await store.visit(record.id, 'alice', at - 1, 0.1);
      expect(await store.get(record.id)).toMatchObject({ lastOpenedAt: at, spendAtVisit: 0.2 });
      await Promise.all([
        store.visit(record.id, 'alice', at + 2, 0.4),
        store.visit(record.id, 'alice', at + 1, 0.3),
      ]);
      expect(await store.get(record.id)).toMatchObject({ lastOpenedAt: at + 2, spendAtVisit: 0.4 });
      if (db)
        expect(await new PgProjectStore(db).get(record.id)).toEqual(await store.get(record.id));
      expect(await store.visit(randomUUID(), 'alice', at, 0)).toBeNull();
    });
    it('counts findings strictly after the visit without depending on pagination', async () => {
      const record = project();
      await store.insert(record);
      await store.saveFinding(record.id, finding());
      await store.saveFinding(record.id, { ...finding(), createdAt: record.createdAt + 11 });
      expect(await store.findingStats(record.id, record.createdAt + 10)).toMatchObject({
        count: 2,
        added: 1,
      });
    });
  });
}
