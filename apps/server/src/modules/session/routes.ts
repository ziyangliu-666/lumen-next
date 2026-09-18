import type { FastifyInstance } from 'fastify';
import { SESSION_MODES, type SessionMode } from '@lumen/contracts';
import { requireUser, type Principal } from '../../core/http/authGuard.js';
import { badRequest } from '../../core/http/httpError.js';
import type { Broker } from '../../core/protocol/broker.js';
import type { Kernel } from './kernel.js';

// What the session slice puts on the wire: three routes and four commands, all
// thin. Ownership is decided in the kernel, once, so a route never checks it.

interface StartBody {
  readonly text?: unknown;
  readonly mode?: unknown;
}

/**
 * Resolves when the principal may open a session under this project, and
 * throws the HttpError to answer with when not (404, never 403). The projects
 * slice supplies it; without one the project id is taken on trust.
 */
export type ProjectGate = (principal: Principal, projectId: string) => Promise<unknown>;

/** The question that opens a session. Empty and whitespace are not questions. */
function textOf(body: unknown): string {
  const raw = (body as StartBody | null)?.text;
  if (typeof raw !== 'string' || raw.trim().length === 0) throw badRequest('text is required');
  return raw.trim();
}

/** Absent means explore. Anything else that is not a mode is the caller's mistake. */
function modeOf(body: unknown): SessionMode {
  const raw = (body as StartBody | null)?.mode;
  if (raw === undefined) return 'explore';
  const mode = SESSION_MODES.find((candidate) => candidate === raw);
  if (!mode) throw badRequest(`mode must be one of: ${SESSION_MODES.join(', ')}`);
  return mode;
}

export function sessionRoutes(
  kernel: Kernel,
  requireProject?: ProjectGate,
): (app: FastifyInstance) => void {
  return (app) => {
    app.post<{ Params: { id: string } }>('/api/projects/:id/sessions', async (request, reply) => {
      const principal = requireUser(request);
      const text = textOf(request.body);
      const mode = modeOf(request.body);
      // Validate first, authorise second, write last: a refused request must
      // leave no session behind.
      await requireProject?.(principal, request.params.id);
      const snapshot = await kernel.start(request.params.id, principal.accountId, text, mode);
      return reply.status(201).send(snapshot);
    });

    app.get<{ Params: { id: string } }>('/api/sessions/:id', (request) =>
      kernel.snapshot(request.params.id, requireUser(request)),
    );

    app.post<{ Params: { id: string } }>('/api/sessions/:id/stop', async (request, reply) => {
      await kernel.stop(request.params.id, requireUser(request));
      return reply.status(204).send();
    });
  };
}

export function sessionCommands(kernel: Kernel): (broker: Broker) => void {
  return (broker) => {
    broker.onCommand('session.open', (command, principal) =>
      kernel.open(command.sessionId, principal),
    );
    // Closing is the bridge's work (it holds the subscription). The claim is
    // here so that the command has an owner and a second claim throws.
    broker.onCommand('session.close', () => undefined);
    broker.onCommand('session.say', (command, principal) =>
      kernel.say(command.sessionId, principal, command.text),
    );
    broker.onCommand('session.stop', (command, principal) =>
      kernel.stop(command.sessionId, principal),
    );
  };
}
