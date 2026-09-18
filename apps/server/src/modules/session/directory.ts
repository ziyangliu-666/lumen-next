import type { SessionMode, SessionSummary } from '@lumen/contracts';
import type { Principal } from '../../core/http/authGuard.js';
import type { Kernel } from './kernel.js';
import type { Trace } from './trace.js';

// What the projects slice needs from sessions, and nothing more. It is handed
// over at composition time (main.ts), so projects never imports a file in here
// and session never imports projects: the types both sides share are in
// packages/contracts.
//
// These are trusted in-process calls. `list`, `context` and `taskSession` take
// no principal, because the caller has already decided whose project it is;
// they must never be put behind a route as they are.
export interface SessionDirectory {
  /** Open a session under a project the caller has already authorised. */
  start(
    this: void,
    projectId: string,
    principal: Principal,
    question: string,
    mode: SessionMode,
  ): Promise<{ id: string }>;
  /** The project's sessions, newest first: one cheap read, no tasks or steps. */
  list(this: void, projectId: string, principal: Principal): Promise<readonly SessionSummary[]>;
  /** Stops the whole task tree. Answers 404 for a session that is not the principal's. */
  stop(this: void, sessionId: string, principal: Principal): Promise<void>;
  /** Which project and account a session belongs to. Null when there is none. */
  context(this: void, sessionId: string): Promise<{ projectId: string; accountId: string } | null>;
  /** Which session a task belongs to. Null when there is none. */
  taskSession(this: void, taskId: string): Promise<string | null>;
}

export function sessionDirectory(kernel: Kernel, trace: Trace): SessionDirectory {
  return {
    start: async (projectId, principal, question, mode) => {
      const snapshot = await kernel.start(projectId, principal.accountId, question, mode);
      return { id: snapshot.session.id };
    },
    list: async (projectId, principal) => {
      const all = await trace.summaries(projectId);
      if (principal.role === 'staff') return all;
      // Belt and braces: the project was authorised by the caller, and a
      // session under it that another account opened is still not shown.
      const mine: SessionSummary[] = [];
      for (const summary of all) {
        const session = await trace.session(summary.id);
        if (session?.accountId === principal.accountId) mine.push(summary);
      }
      return mine;
    },
    stop: (sessionId, principal) => kernel.stop(sessionId, principal),
    context: async (sessionId) => {
      const session = await trace.session(sessionId);
      return session ? { projectId: session.projectId, accountId: session.accountId } : null;
    },
    taskSession: async (taskId) => (await trace.task(taskId))?.sessionId ?? null,
  };
}
