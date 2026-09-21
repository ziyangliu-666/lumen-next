import type { Money, StepDetail, StepRow } from '@lumen/contracts';

// What a worker hands to appendStep comes from outside the kernel: a real one
// will carry the output of a process and the text of a web page. It is kept in
// the record and sent in every snapshot and on every socket, so it is checked
// and bounded here, once, before it is written. A wrong shape is the worker's
// bug and throws. Too much text is normal and is cut, with a line that says so.

/** The longest output kept on a step. A terminal can print megabytes; the page shows a block. */
export const MAX_OUTPUT_CHARS = 20_000;
export const MAX_ROWS = 50;
const MAX_FIELD_CHARS = 500;
const MAX_TOOL_CHARS = 40;

const NUL = String.fromCharCode(0);

/**
 * Text that Postgres will take. jsonb and text both refuse the NUL character,
 * and jsonb refuses half a surrogate pair, which is what `slice` leaves when it
 * cuts an emoji in two. The first is dropped and the second repaired, never
 * stored: MemoryTrace would accept them, and then the record would work in
 * tests and fail in production.
 */
export function storable(text: string): string {
  return text.replaceAll(NUL, '').toWellFormed();
}

function field(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`step detail: ${name} must be a string`);
  const clean = storable(value);
  return clean.length > MAX_FIELD_CHARS
    ? storable(`${clean.slice(0, MAX_FIELD_CHARS - 1)}`) + '…'
    : clean;
}

function row(value: unknown, index: number): StepRow {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`step detail: rows[${index}] must be an object`);
  }
  const raw = value as Record<string, unknown>;
  return {
    source: field(raw['source'], `rows[${index}].source`),
    text: field(raw['text'], `rows[${index}].text`),
    result: field(raw['result'], `rows[${index}].result`),
    ...(raw['empty'] === true ? { empty: true } : {}),
  };
}

/**
 * The detail as it will be kept: only the fields the contract names, each of
 * the right type, text made storable, output and rows cut to their bounds.
 * `cost` is left to the caller, which has its own rule for an amount, and
 * `childTaskIds` is never taken from a worker (see Kernel.appendStep).
 */
export function checkedDetail(detail: StepDetail): StepDetail {
  const raw = detail as Record<string, unknown>;
  const kept: { -readonly [K in keyof StepDetail]: StepDetail[K] } = {};

  if (raw['tool'] !== undefined) {
    const tool = field(raw['tool'], 'tool');
    if (tool.length === 0 || tool.length > MAX_TOOL_CHARS) {
      throw new Error(`step detail: tool must be 1 to ${MAX_TOOL_CHARS} characters`);
    }
    kept.tool = tool;
  }
  if (raw['durationMs'] !== undefined) {
    const ms = raw['durationMs'];
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
      throw new Error('step detail: durationMs must be a non-negative number');
    }
    kept.durationMs = Math.round(ms);
  }
  if (raw['rows'] !== undefined) {
    if (!Array.isArray(raw['rows'])) throw new Error('step detail: rows must be an array');
    const all: unknown[] = raw['rows'];
    const rows = all.slice(0, MAX_ROWS).map(row);
    const dropped = all.length - rows.length;
    // The cut is a row of its own, so the page shows that there was more.
    if (dropped > 0) rows.push({ source: '…', text: `${dropped} more rows not kept`, result: '' });
    kept.rows = rows;
  }
  if (raw['output'] !== undefined) {
    if (typeof raw['output'] !== 'string') throw new Error('step detail: output must be a string');
    const output = storable(raw['output']);
    const over = output.length - MAX_OUTPUT_CHARS;
    kept.output =
      over > 0
        ? `${storable(output.slice(0, MAX_OUTPUT_CHARS))}\n… ${over} more characters not kept`
        : output;
  }
  // Null, 0 as a bare number, '' : not Money. The caller's rule would never
  // see them, because it only looks at a cost that is truthy.
  if (raw['cost'] !== undefined) {
    const cost = raw['cost'];
    if (typeof cost !== 'object' || cost === null || typeof (cost as Money).dollars !== 'number') {
      throw new Error('step detail: cost must be Money');
    }
    kept.cost = cost as Money;
  }
  return kept;
}
