// Session's SessionDirectory, over HTTP. The projects slice and steering both
// take it as a port. Its start and stop reach the running kernel, which lives
// only in the session pod, so the project and worker services call session
// for all five members (docs/platform/contract.md, "Steering's reads").
//
// The projects slice already wraps every call in `dependency()`, which turns
// a failure into "Session service unavailable", and passes a 4xx HttpError
// through unchanged. The client keeps that contract: a 4xx from session is
// an HttpError with the same status (InternalCallError extends it).
import type { FastifyInstance } from 'fastify';
import type { SessionMode, SessionSummary } from '@lumen/contracts';
import type { Principal } from '../../core/http/authGuard.js';
import { HttpError } from '../../core/http/httpError.js';
import type { SessionDirectory } from '../../modules/session/index.js';
import { requireInternalKey, type InternalCall } from './internal.js';

type Context = Awaited<ReturnType<SessionDirectory['context']>>;

export function remoteSessionDirectory(call: InternalCall): SessionDirectory {
  return {
    start: (projectId, principal, question, mode, model) =>
      call<{ id: string }>('/internal/directory/start', {
        projectId,
        principal,
        question,
        mode,
        ...(model === undefined ? {} : { model }),
      }),
    list: async (projectId, principal) =>
      (
        await call<{ sessions: SessionSummary[] }>('/internal/directory/list', {
          projectId,
          principal,
        })
      ).sessions,
    stop: async (sessionId, principal) => {
      await call('/internal/directory/stop', { sessionId, principal });
    },
    context: async (sessionId) =>
      (await call<{ context: Context }>('/internal/directory/context', { sessionId })).context,
    taskSession: async (taskId) =>
      (await call<{ sessionId: string | null }>('/internal/directory/task-session', { taskId }))
        .sessionId,
  };
}

interface DirectoryBody {
  readonly projectId: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly principal: Principal;
  readonly question: string;
  readonly mode: SessionMode;
  readonly model?: string;
}

/** The session side. The principal arrives from a service that already resolved it. */
export function registerDirectoryRoutes(
  app: FastifyInstance,
  directory: SessionDirectory,
  key: string,
): void {
  const options = { preHandler: requireInternalKey(key) };
  const answer = async (
    work: () => Promise<unknown>,
    reply: { status(code: number): { send(body?: unknown): unknown } },
  ): Promise<unknown> => {
    try {
      const result = await work();
      return result === undefined ? reply.status(204).send() : reply.status(200).send(result);
    } catch (error) {
      if (error instanceof HttpError)
        return reply.status(error.status).send({ error: error.message });
      throw error;
    }
  };

  app.post<{ Body: DirectoryBody }>('/internal/directory/start', options, (request, reply) => {
    const { projectId, principal, question, mode, model } = request.body;
    return answer(() => directory.start(projectId, principal, question, mode, model), reply);
  });
  app.post<{ Body: DirectoryBody }>('/internal/directory/list', options, (request, reply) =>
    answer(
      async () => ({
        sessions: await directory.list(request.body.projectId, request.body.principal),
      }),
      reply,
    ),
  );
  app.post<{ Body: DirectoryBody }>('/internal/directory/stop', options, (request, reply) =>
    answer(() => directory.stop(request.body.sessionId, request.body.principal), reply),
  );
  app.post<{ Body: DirectoryBody }>('/internal/directory/context', options, (request, reply) =>
    answer(async () => ({ context: await directory.context(request.body.sessionId) }), reply),
  );
  app.post<{ Body: DirectoryBody }>('/internal/directory/task-session', options, (request, reply) =>
    answer(async () => ({ sessionId: await directory.taskSession(request.body.taskId) }), reply),
  );
}
