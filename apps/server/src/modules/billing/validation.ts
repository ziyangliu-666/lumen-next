import type { Money } from '@lumen/contracts';
import { badRequest } from '../../core/http/httpError.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reject precision loss before numeric(12,6) can round the input. */
export function money(value: unknown): Money {
  if (!value || typeof value !== 'object' || !('dollars' in value))
    throw badRequest('expected money');
  const dollars = value.dollars;
  if (
    typeof dollars !== 'number' ||
    !Number.isFinite(dollars) ||
    dollars < 0 ||
    dollars > 999999.999999 ||
    !/^\d+(\.\d{1,6})?$/.test(String(dollars))
  ) {
    throw badRequest(
      'amount must be non-negative dollars with at most six decimals and below 1000000',
    );
  }
  return { dollars };
}

export function cursorId(cursor: string): string {
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!UUID.test(id) || Buffer.from(id).toString('base64url') !== cursor)
    throw badRequest('invalid ledger cursor');
  return id;
}
