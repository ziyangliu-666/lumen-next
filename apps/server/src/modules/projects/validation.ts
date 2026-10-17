import { badRequest } from '../../core/http/httpError.js';
import type { Page, PageRequest, Position, ProjectMode } from './models.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function idOf(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw badRequest('Invalid resource ID.');
  return value.toLowerCase();
}
export function objectOf(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw badRequest('Expected an object.');
  if (Object.keys(value).some((key) => !keys.includes(key))) throw badRequest('Unexpected field.');
  return value as Record<string, unknown>;
}
export function textOf(value: unknown, max: number): string {
  if (typeof value !== 'string') throw badRequest('Text is required.');
  const text = value.trim();
  if (!text || [...text].length > max)
    throw badRequest(`Text must contain 1 to ${max} characters.`);
  return text;
}
export function creationOf(value: unknown): {
  question: string;
  mode: ProjectMode;
  model?: string;
} {
  const body = objectOf(value, ['question', 'mode', 'model']);
  if (body.mode !== 'explore' && body.mode !== 'seed') throw badRequest('Choose explore or seed.');
  // The model is checked against the allowed list where the session opens.
  if (body.model !== undefined && (typeof body.model !== 'string' || !body.model.trim()))
    throw badRequest('model must be a name');
  return {
    question: textOf(body.question, 10000),
    mode: body.mode,
    ...(typeof body.model === 'string' ? { model: body.model } : {}),
  };
}

/** A cursor is a position, never an authorisation token. Every query still checks ownership. */
export function pageOf(value: unknown, scope: string): PageRequest {
  const query = objectOf(value, ['limit', 'cursor']);
  const raw = query.limit ?? '20';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw badRequest('Invalid limit.');
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw badRequest('Limit must be 1 to 100.');
  if (query.cursor === undefined) return { limit, after: null };
  if (typeof query.cursor !== 'string' || !/^[\w-]{1,2048}$/.test(query.cursor))
    throw badRequest('Invalid cursor.');
  try {
    const parsed: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
    const cursor = objectOf(parsed, ['scope', 'createdAt', 'id']);
    if (
      cursor.scope !== scope ||
      typeof cursor.createdAt !== 'number' ||
      !Number.isSafeInteger(cursor.createdAt) ||
      cursor.createdAt < 0
    )
      throw new Error('cursor');
    return { limit, after: { createdAt: cursor.createdAt, id: idOf(cursor.id) } };
  } catch {
    throw badRequest('Invalid cursor.');
  }
}
export function pageResult<T extends Position>(
  rows: readonly T[],
  limit: number,
  scope: string,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(JSON.stringify({ scope, createdAt: last.createdAt, id: last.id })).toString(
          'base64url',
        )
      : null;
  return { items, nextCursor };
}
export function newest(a: Position, b: Position): number {
  return b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}
export function afterPosition(item: Position, after: Position | null): boolean {
  return after === null || newest(item, after) > 0;
}
