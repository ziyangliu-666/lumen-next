import { useEffect, useState } from 'react';

// How long ago something moved, in the words a person says: "4 min ago",
// "2 h ago", "yesterday". A list is read for which project moved last, not for
// the exact minute, so the exact time goes in the <time> element's dateTime
// and title instead.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function ago(at: number, now: number): string {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 2 * DAY) return 'yesterday';
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} days ago`;
  if (elapsed < 14 * DAY) return 'last week';
  return `on ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/**
 * The time a list measures its ages against. It moves once a minute, so
 * "4 min ago" does not stay on screen for an hour between two polls.
 */
export function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
