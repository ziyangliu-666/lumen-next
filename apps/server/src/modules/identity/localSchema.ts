import { readFile } from 'node:fs/promises';

/** Local fixtures only. Production migrations belong to core's runner. */
export async function readLocalBaseSchema(): Promise<string> {
  const migration = await readFile(
    new URL('../../core/db/migrations/001_core_base.sql', import.meta.url),
    'utf8',
  );
  const up = '-- Up Migration';
  const down = '-- Down Migration';
  const start = migration.indexOf(up);
  const end = migration.indexOf(down);
  if (start < 0 || end <= start) throw new Error('Unexpected core base migration format');
  // Never execute the down section while bootstrapping a disposable fixture.
  return migration.slice(start + up.length, end);
}
