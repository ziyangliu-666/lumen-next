import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Intro, introWanted } from './Intro';

describe('landing intro', () => {
  it('says what lumen does in words a screen reader reads, and can be skipped', () => {
    const html = renderToStaticMarkup(<Intro onDone={() => undefined} />);
    expect(html).toContain('searches the literature');
    expect(html).toContain('Skip');
  });

  it('does not play where nothing can be kept or asked (no browser)', () => {
    expect(introWanted()).toBe(false);
  });
});
