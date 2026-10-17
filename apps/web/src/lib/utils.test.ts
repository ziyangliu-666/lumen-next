import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a theme font size beside a text colour', () => {
    // Without the font-size config these two read as one colour group, and
    // the 13px hint line under every field would render at 16px.
    expect(cn('mt-2 text-caption', 'text-ink-2')).toBe('mt-2 text-caption text-ink-2');
    expect(cn('text-display', 'text-ink')).toBe('text-display text-ink');
  });

  it('still lets a later font size replace an earlier one', () => {
    expect(cn('text-sm', 'text-caption')).toBe('text-caption');
    expect(cn('text-caption', 'text-base')).toBe('text-base');
  });
});
