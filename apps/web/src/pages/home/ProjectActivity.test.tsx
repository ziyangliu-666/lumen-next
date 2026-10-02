import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectActivity } from './ProjectActivity';

describe('Home project activity preparation', () => {
  it('renders a mark and the authoritative change counts and spend', () => {
    const html = renderToStaticMarkup(
      <ProjectActivity
        lastOpenedAt={1000}
        activity={{ sessionsEnded: 2, findingsAdded: 3, spend: { dollars: 0.123456 } }}
      />,
    );
    expect(html).toContain('New activity');
    expect(html).toContain('2 sessions ended');
    expect(html).toContain('3 findings added');
    expect(html).toContain('$0.1235');
    expect(html).toContain('1970-01-01T00:00:01.000Z');
  });
  it.each([
    { sessionsEnded: 1, findingsAdded: 0, spend: { dollars: 0 } },
    { sessionsEnded: 0, findingsAdded: 1, spend: { dollars: 0 } },
    { sessionsEnded: 0, findingsAdded: 0, spend: { dollars: 0.000001 } },
  ])(
    'marks each kind of change independently, including sub-display-precision spend',
    (activity) => {
      expect(
        renderToStaticMarkup(<ProjectActivity lastOpenedAt={1000} activity={activity} />),
      ).toContain('New activity');
    },
  );
  it('removes the mark when a confirmed visit returns an empty summary', () => {
    const html = renderToStaticMarkup(
      <ProjectActivity
        lastOpenedAt={2000}
        activity={{ sessionsEnded: 0, findingsAdded: 0, spend: { dollars: 0 } }}
      />,
    );
    expect(html).not.toContain('New activity');
    expect(html).toContain('No changes since your last visit');
  });
  it('does not claim zero spend or no changes when spend is unavailable', () => {
    const html = renderToStaticMarkup(
      <ProjectActivity
        lastOpenedAt={null}
        activity={{ sessionsEnded: 0, findingsAdded: 0, spend: null }}
      />,
    );
    expect(html).toContain('Since project creation');
    expect(html).toContain('Spend unavailable');
    expect(html).not.toContain('$0.0000');
    expect(html).not.toContain('No changes');
    expect(html).not.toContain('New activity');
  });
});
