// GET /api/v1/questions/:sessionId, in the session service
// (docs/platform/public-api.md). It is a read of the kernel's snapshot, the
// same record the web app's session page starts from, in the shape of the
// public API. The kernel answers 404 for a session that is not the caller's,
// so an id is not an oracle.
import type { FastifyInstance } from 'fastify';
import type { Finding, SessionSnapshot } from '@lumen/contracts';
import { requireUser, type Principal } from '../../core/http/authGuard.js';
import { notFound } from '../../core/http/httpError.js';
import { isUuid } from './registry.js';

export interface AnswerRouteDeps {
  readonly snapshot: (sessionId: string, principal: Principal) => Promise<SessionSnapshot>;
  readonly findings: (sessionId: string) => Promise<readonly Finding[]>;
  readonly agentOfSession: (sessionId: string) => Promise<string | null>;
}

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

/** The public answer, from a snapshot. `answer` is the root task's last reply. */
export function answerOf(
  snapshot: SessionSnapshot,
  findings: readonly Finding[],
  agent: string | null,
): Record<string, unknown> {
  const root = snapshot.tasks.find((task) => task.parentId === null);
  if (!root) throw notFound('no such session');
  const replies = snapshot.steps.filter((step) => step.taskId === root.id && step.kind === 'reply');
  const last = replies.reduce<(typeof replies)[number] | null>(
    (latest, step) => (latest === null || step.index > latest.index ? step : latest),
    null,
  );
  return {
    sessionId: snapshot.session.id,
    status: root.status,
    agent,
    answer: last?.text ?? null,
    findings: findings.map((finding) => ({
      id: finding.id,
      title: finding.title ?? null,
      text: finding.text,
      createdAt: iso(finding.createdAt),
    })),
    cost: snapshot.spend.dollars,
    startedAt: iso(root.startedAt),
    endedAt: iso(root.endedAt),
  };
}

export function registerAnswerRoutes(app: FastifyInstance, deps: AnswerRouteDeps): void {
  app.get<{ Params: { sessionId: string } }>('/api/v1/questions/:sessionId', async (request) => {
    const principal = requireUser(request);
    const { sessionId } = request.params;
    // The trace keys sessions by uuid; anything else is no session, not a 500.
    if (!isUuid(sessionId)) throw notFound('no such session');
    const snapshot = await deps.snapshot(sessionId, principal);
    const [findings, agent] = await Promise.all([
      deps.findings(sessionId),
      deps.agentOfSession(sessionId),
    ]);
    return answerOf(snapshot, findings, agent);
  });
}
