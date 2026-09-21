import { describe, expect, it } from 'vitest';
import type { StepDetail } from '@lumen/contracts';
import { checkedDetail, MAX_OUTPUT_CHARS, MAX_ROWS, storable } from './stepDetail.js';

const NUL = String.fromCharCode(0);

describe('session: what a step may carry', () => {
  it('drops the characters Postgres refuses: NUL, and half of a surrogate pair', () => {
    const half = '😀'.slice(0, 1);

    expect(storable(`a${NUL}b`)).toBe('ab');
    expect(storable(`ok ${half}`)).toBe('ok �');
    expect(storable('plain ✓ 😀')).toBe('plain ✓ 😀');
  });

  it('keeps only the fields the contract names, and rounds a duration', () => {
    const detail = { tool: 'run', durationMs: 8940.6, extra: 'dropped' } as unknown as StepDetail;

    expect(checkedDetail(detail)).toEqual({ tool: 'run', durationMs: 8941 });
  });

  it('cuts an output that is too long and says how much it cut', () => {
    const kept = checkedDetail({ output: 'x'.repeat(MAX_OUTPUT_CHARS + 123) }).output!;

    expect(kept.startsWith('x'.repeat(MAX_OUTPUT_CHARS))).toBe(true);
    expect(kept.endsWith('\n… 123 more characters not kept')).toBe(true);
  });

  it('does not leave half an emoji where it cut the output', () => {
    const output = `${'x'.repeat(MAX_OUTPUT_CHARS - 1)}😀 and more`;
    const kept = checkedDetail({ output }).output!;

    expect(kept.isWellFormed()).toBe(true);
  });

  it('keeps at most the first rows, and adds a row that says how many it left out', () => {
    const rows = Array.from({ length: MAX_ROWS + 7 }, (_, n) => ({
      source: 'oeis',
      text: `q${n}`,
      result: 'x',
    }));
    const kept = checkedDetail({ rows }).rows!;

    expect(kept).toHaveLength(MAX_ROWS + 1);
    expect(kept.at(-1)).toEqual({ source: '…', text: '7 more rows not kept', result: '' });
  });

  it('cleans the text inside a row and keeps the empty mark only when it is true', () => {
    const rows = [
      { source: 'arxiv', text: `a${NUL}b`, result: 'nothing', empty: true },
      { source: 'oeis', text: 'y'.repeat(900), result: 'x', empty: false },
    ];
    const kept = checkedDetail({ rows }).rows!;

    expect(kept[0]).toEqual({ source: 'arxiv', text: 'ab', result: 'nothing', empty: true });
    expect(kept[1]).not.toHaveProperty('empty');
    expect(kept[1]?.text).toHaveLength(500);
  });

  it('throws for a shape the contract does not allow, because that is the worker being wrong', () => {
    const bad =
      (detail: unknown): (() => StepDetail) =>
      () =>
        checkedDetail(detail as StepDetail);

    expect(bad({ rows: 'not an array' })).toThrow(/rows must be an array/);
    expect(bad({ rows: [{ source: 'x', text: 1, result: 'y' }] })).toThrow(/rows\[0\]\.text/);
    expect(bad({ output: 42 })).toThrow(/output must be a string/);
    expect(bad({ durationMs: -1 })).toThrow(/durationMs/);
    expect(bad({ durationMs: Number.NaN })).toThrow(/durationMs/);
    expect(bad({ tool: '' })).toThrow(/tool must be/);
  });
});
