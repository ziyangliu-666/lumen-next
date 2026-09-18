import { describe, expect, it } from 'vitest';
import { readLocalBaseSchema } from './localSchema.js';

describe('identity: local base-schema fixture', () => {
  it('reads the current core migration without executing its down section', async () => {
    const sql = await readLocalBaseSchema();
    expect(sql).toContain('create table accounts');
    expect(sql).toContain('create table steps');
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toContain('-- Down Migration');
  });
});
