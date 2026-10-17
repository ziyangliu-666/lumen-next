// Owner: PENG XUJIAN. Page: Landing. What sits under the field: the
// person's recent projects when they have some, and starter questions when
// they have none, as chat products show their recents and their "Try" cards.
import { useEffect, useState, type JSX } from 'react';
import { request } from '@/core/api';

/**
 * Three questions of the kind lumen is for. A card fills the field and does
 * not send it: a start spends money, so the person sends it themselves.
 */
const STARTERS = [
  {
    title: 'Dyck paths by peaks',
    question:
      'Count Dyck paths of semilength n by peaks and by double rises for n up to 10, and check both tables against the OEIS.',
  },
  {
    title: 'Pattern-avoiding involutions',
    question:
      'How many involutions of length n avoid the pattern 4321? Compute to n = 12 and find the sequence in the OEIS.',
  },
  {
    title: 'Check a known claim',
    question:
      'Is the number of 321-avoiding involutions of length n the central binomial coefficient? Check it to n = 14.',
  },
] as const;

export function Starters({ onPick }: { onPick: (question: string) => void }): JSX.Element {
  return (
    <ul aria-label="Try a question" className="grid gap-2 roomy:grid-cols-3">
      {STARTERS.map((starter) => (
        <li key={starter.title}>
          <button
            type="button"
            onClick={() => onPick(starter.question)}
            className="flex h-full w-full flex-col gap-1 border border-rule-minor bg-paper/70 p-3 text-left hover:border-ink"
          >
            <span className="text-sm font-medium text-ink">{starter.title}</span>
            <span className="line-clamp-3 text-caption text-ink-2">{starter.question}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface Recent {
  readonly project: { readonly id: string; readonly title: string };
  readonly latestSession?: { readonly id: string } | null;
  readonly label?: string;
}

/** Up to four projects, latest first, as returned by the projects route. */
export function useRecent(enabled: boolean): readonly Recent[] | null {
  const [items, setItems] = useState<readonly Recent[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    request<{ items?: Recent[] }>('/api/projects').then(
      (body) => active && setItems((body.items ?? []).slice(0, 4)),
      () => active && setItems([]),
    );
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? items : null;
}

export function RecentProjects({ items }: { items: readonly Recent[] }): JSX.Element {
  return (
    <section aria-labelledby="recent-name">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 id="recent-name" className="text-sm font-medium text-ink-2">
          Recent
        </h2>
        <a href="#/home" className="text-sm text-ink-2 hover:text-ink hover:underline">
          All projects
        </a>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.project.id} className="border-t border-rule-minor first:border-t-0">
            <a
              href={
                item.latestSession
                  ? `?session=${encodeURIComponent(item.latestSession.id)}#/session`
                  : '#/home'
              }
              className="flex items-baseline justify-between gap-4 py-2 hover:underline"
            >
              <span className="truncate text-sm text-ink">{item.project.title}</span>
              {item.label ? (
                <span className="shrink-0 text-caption text-ink-2">{item.label}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Good evening, Ada." The hour is the browser's own. */
export function greeting(name: string, hour = new Date().getHours()): string {
  const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first ? `Good ${part}, ${first}.` : `Good ${part}.`;
}
