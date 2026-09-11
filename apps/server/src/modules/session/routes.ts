import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest } from '../../core/http/httpError.js';
import type { Broker } from '../../core/protocol/broker.js';
import type { Kernel } from './kernel.js';

// What the session slice puts on the wire: three routes and two commands, all
// thin. Ownership is decided in the kernel, once, so a route never checks it.

interface StartBody {
  readonly text?: unknown;
}

/** The question that opens a session. Empty and whitespace are not questions. */
function textOf(body: unknown): string {
  const raw = (body as StartBody | null)?.text;
  if (typeof raw !== 'string' || raw.trim().length === 0) throw badRequest('text is required');
  return raw.trim();
}

export function sessionRoutes(kernel: Kernel): (app: FastifyInstance) => void {
  return (app) => {
    // The project id is taken on trust in Sprint 1: there is no project store
    // to ask. Projects' `projectOf` closes that when it lands.
    app.post<{ Params: { id: string } }>('/api/projects/:id/sessions', (request, reply) => {
      const principal = requireUser(request);
      const snapshot = kernel.start(request.params.id, principal.accountId, textOf(request.body));
      return reply.status(201).send(snapshot);
    });

    app.get<{ Params: { id: string } }>('/api/sessions/:id', (request) =>
      kernel.snapshot(request.params.id, requireUser(request)),
    );

    app.post<{ Params: { id: string } }>('/api/sessions/:id/stop', (request, reply) => {
      kernel.stop(request.params.id, requireUser(request));
      return reply.status(204).send();
    });
  };
}

export function sessionCommands(kernel: Kernel): (broker: Broker) => void {
  return (broker) => {
    broker.onCommand('session.say', (command, principal) =>
      kernel.say(command.sessionId, principal, command.text),
    );
    broker.onCommand('session.stop', (command, principal) => {
      kernel.stop(command.sessionId, principal);
    });
  };
}
