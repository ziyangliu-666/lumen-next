import type { Money, TaskStatus } from '@lumen/contracts';

export type ProjectMode = 'explore' | 'seed';
export interface Project {
  readonly id: string;
  readonly accountId: string;
  readonly title: string;
  readonly mode: ProjectMode;
  readonly createdAt: number;
}
export type ProjectSummary = Omit<Project, 'accountId'>;
export interface Finding {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly text: string;
  readonly createdAt: number;
}
export interface LatestSession {
  readonly id: string;
  readonly mode: ProjectMode;
  readonly status: TaskStatus;
  readonly spend: Money;
  readonly startedAt: number;
  readonly endedAt: number | null;
}
export interface ProjectCard {
  readonly project: ProjectSummary;
  readonly latestSession: LatestSession | null;
  readonly findingsCount: number;
  readonly lastActivityAt: number;
  readonly label: string;
  readonly tone: 'muted' | 'active' | 'decide' | 'keep' | 'gap';
  readonly actions: { readonly openSession: boolean; readonly stopLatestSession: boolean };
  readonly refreshPolicy: 'poll' | 'manual';
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
