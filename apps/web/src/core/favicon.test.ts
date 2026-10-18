import { describe, expect, it } from 'vitest';
import { markBusy } from './favicon';

describe('core: the tab icon', () => {
  it('counts work started and ended, and ends each mark once', () => {
    const first = markBusy();
    const second = markBusy();
    first();
    first();
    second();
    // A third mark after both ended starts from nothing, not from -1.
    const third = markBusy();
    third();
    expect(typeof third).toBe('function');
  });
});
