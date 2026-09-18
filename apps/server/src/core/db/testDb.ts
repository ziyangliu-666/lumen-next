import { randomUUID } from 'node:crypto';
import { openDatabase, type Db } from './db.js';

// Database tests need a database. CI provides one as a service container and
// sets DATABASE_URL; locally, `docker compose up db` and the URL in
// .env.example do the same. Without it these tests skip rather than fail, so
// `npm run verify` stays usable on a laptop with no Postgres.
export const TEST_DATABASE_URL = process.env['DATABASE_URL'];

/** A migrated Db in a schema of its own, and the function that removes it. */
export async function openTestDb(): Promise<{ db: Db; drop: () => Promise<void> }> {
  if (!TEST_DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const db = await openDatabase(TEST_DATABASE_URL, { schema });
  return {
    db,
    drop: async () => {
      await db.query(`drop schema "${schema}" cascade`);
      await db.close();
    },
  };
}
