import type { SessionMode, SessionSummary } from '@lumen/contracts';
export type { Finding, SessionSummary as LatestSession } from '@lumen/contracts';

export type ProjectMode = SessionMode;
export interface Project {
  readonly id: string;
  readonly accountId: string;
  readonly title: string;
  readonly mode: ProjectMode;
  readonly createdAt: number;
  readonly lastOpenedAt: number | null;
  readonly spendAtVisit: number;
}
export type ProjectSummary = Omit<Project, 'accountId' | 'lastOpenedAt' | 'spendAtVisit'>;
export interface ProjectCard {
  readonly lastOpenedAt: number | null;
  readonly sinceLastVisit: {
    readonly sessionsEnded: number;
    readonly findingsAdded: number;
    readonly spend: { readonly dollars: number };
  };
  readonly project: ProjectSummary;
  readonly latestSession: SessionSummary | null;
  readonly findingsCount: number;
  readonly lastActivityAt: number;
  readonly label: string;
  readonly tone: 'muted' | 'active' | 'decide' | 'keep' | 'gap';
  readonly actions: { readonly openSession: boolean; readonly stopLatestSession: boolean };
  readonly refreshPolicy: 'poll' | 'manual';
  readonly pollAfterMs: number | null;
}
export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
export interface Position {
  readonly createdAt: number;
  readonly id: string;
}
export interface PageRequest {
  readonly limit: number;
  readonly after: Position | null;
}
export interface StopResult {
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly outcome: 'stop_requested' | 'already_terminal' | 'no_session';
}
