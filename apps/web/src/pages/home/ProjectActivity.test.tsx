import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectActivity } from './ProjectActivity';

describe('Home project activity mark', () => {
  it('counts what changed, with the visit in the tooltip', () => {
    const html = renderToStaticMarkup(
      <ProjectActivity
        lastOpenedAt={1000}
        activity={{ sessionsEnded: 2, findingsAdded: 3, spend: { dollars: 0.123456 } }}
      />,
    );
    expect(html).toContain('New:');
    expect(html).toContain('3 findings, 2 sessions ended');
    expect(html).toContain('Since your last visit');
    // The row shows spend already.
    expect(html).not.toContain('$');
  });
  it.each([
    { sessionsEnded: 1, findingsAdded: 0, spend: { dollars: 0 } },
    { sessionsEnded: 0, findingsAdded: 1, spend: null },
  ])('marks each kind of change independently', (activity) => {
    expect(
      renderToStaticMarkup(<ProjectActivity lastOpenedAt={1000} activity={activity} />),
    ).toContain('New:');
  });
  it.each([
    { sessionsEnded: 0, findingsAdded: 0, spend: { dollars: 0 } },
    { sessionsEnded: 0, findingsAdded: 0, spend: { dollars: 0.5 } },
    { sessionsEnded: 0, findingsAdded: 0, spend: null },
  ])('says nothing when no session ended and no finding was added', (activity) => {
    expect(renderToStaticMarkup(<ProjectActivity lastOpenedAt={null} activity={activity} />)).toBe(
      '',
    );
  });
});
