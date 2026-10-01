import type { SessionMode, SessionSummary } from '@lumen/contracts';
export type { Finding } from '@lumen/contracts';
// Projects-specific wire shapes stay page-local until adopted by contracts.
export interface ProjectCard {
  lastOpenedAt: number | null;
  sinceLastVisit: { sessionsEnded: number; findingsAdded: number; spend: { dollars: number } };
  project: { id: string; title: string; mode: SessionMode; createdAt: number };
  latestSession: SessionSummary | null;
  findingsCount: number;
  lastActivityAt: number;
  label: string;
  tone: 'muted' | 'active' | 'decide' | 'keep' | 'gap';
  actions: { openSession: boolean; stopLatestSession: boolean };
  refreshPolicy: 'poll' | 'manual';
  pollAfterMs: number | null;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export function sessionLink(id: string, taskId?: string): string {
  const query = new URLSearchParams({ session: id });
  if (taskId) query.set('task', taskId);
  return `?${query.toString()}#/session`;
}
