import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { greeting, RecentProjects, Starters } from './starts';

describe('landing: under the field', () => {
  it('greets by the first name and the hour', () => {
    expect(greeting('Ada Lovelace', 9)).toBe('Good morning, Ada.');
    expect(greeting('ada', 14)).toBe('Good afternoon, ada.');
    expect(greeting('', 21)).toBe('Good evening.');
    expect(greeting('Ada', 2)).toBe('Good evening, Ada.');
  });

  it('offers starter questions as buttons, and lists recent projects with their sessions', () => {
    expect(
      renderToStaticMarkup(<Starters onPick={() => undefined} />).match(/<button/g),
    ).toHaveLength(3);
    const html = renderToStaticMarkup(
      <RecentProjects
        items={[
          {
            project: { id: 'p1', title: 'Dyck paths' },
            latestSession: { id: 's1' },
            label: 'Finished',
          },
        ]}
      />,
    );
    expect(html).toContain('href="?session=s1#/session"');
    expect(html).toMatch(/Dyck paths.*Finished/s);
    expect(html).toContain('All projects');
  });
});
