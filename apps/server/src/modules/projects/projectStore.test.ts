import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../../core/db/db.js';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice } from '../session/index.js';
import { MemoryProjectStore } from './memoryProjectStore.js';
import { PgProjectStore } from './pgProjectStore.js';
import type { ProjectStore } from './ports.js';
import type { Finding, Project } from './models.js';

const url = process.env['DATABASE_URL'];
for (const database of [false, true]) {
  describe.skipIf(database && !url)(database ? 'PgProjectStore' : 'MemoryProjectStore', () => {
    let store: ProjectStore;
    let db: Db | undefined;
    let schema: string;
    let sessionId: string;
    let taskId: string;
    beforeEach(async () => {
      if (database && url) {
        schema = `test_projects_${randomUUID().replaceAll('-', '')}`;
        await runner({
          databaseUrl: url,
          // Every case owns a fresh schema; no migration is shared with other tests.
          noLock: true,
          useGlob: true,
          dir: [
            fileURLToPath(new URL('../../core/db/migrations', import.meta.url)).replaceAll(
              '\\',
              '/',
            ) + '/*.sql',
            fileURLToPath(new URL('./migrations', import.meta.url)).replaceAll('\\', '/') +
              '/*.sql',
          ],
          direction: 'up',
          migrationsTable: 'pgmigrations',
          schema,
          createSchema: true,
          log: () => {},
        });
        db = await openDatabase(url, { schema, migrate: false });
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
      if (db) {
        await db.query(`drop schema "${schema}" cascade`);
        await db.close();
        db = undefined;
      }
    });
    function project(accountId = 'alice', id = randomUUID()): Project {
      return { id, accountId, title: 'Research', mode: 'seed', createdAt: 1234567890000 };
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
      expect(await store.findingStats(record.id)).toEqual({ count: 2, lastAt: a.createdAt });
      expect(await store.findingStats(randomUUID())).toEqual({ count: 0, lastAt: null });
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
  });
}
