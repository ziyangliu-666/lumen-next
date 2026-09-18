import type { Money, TaskStatus } from '@lumen/contracts';
// Page-local wire declarations until the reviewed shared-contract patch lands.
export interface ProjectCard {
  project: { id: string; title: string; mode: 'explore' | 'seed'; createdAt: number };
  latestSession: {
    id: string;
    mode: 'explore' | 'seed';
    status: TaskStatus;
    spend: Money;
    startedAt: number;
    endedAt: number | null;
  } | null;
  findingsCount: number;
  lastActivityAt: number;
  label: string;
  tone: 'muted' | 'active' | 'decide' | 'keep' | 'gap';
  actions: { openSession: boolean; stopLatestSession: boolean };
  refreshPolicy: 'poll' | 'manual';
}
export interface Finding {
  id: string;
  sessionId: string;
  taskId: string;
  text: string;
  createdAt: number;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export class RequestFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message =
      response.status === 401
        ? 'Sign in to see your projects.'
        : `Request failed (${response.status}). Please try refreshing.`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string')
        message = body.error;
    } catch {
      /* Use the status when the response is not JSON. */
    }
    throw new RequestFailure(response.status, message);
  }
  return (await response.json()) as T;
}
export function sessionLink(id: string, taskId?: string): string {
  const query = new URLSearchParams({ session: id });
  if (taskId) query.set('task', taskId);
  return `?${query.toString()}#/session`;
}
