import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ServerEvent } from '@lumen/contracts';
import type { Broker } from '../protocol/broker.js';
import { parseCommand } from '../protocol/parseCommand.js';
import type { Principal, SessionAccess } from './authGuard.js';

// The seam between the domain and the wire. Above this file everything speaks
// ServerEvent and ClientCommand; below it, frames on a socket.

/** WebSocket.OPEN. Inlined so the module does not import `ws` for one number. */
const OPEN = 1;

interface StreamQuery {
  readonly session?: string;
}

/** ws hands us a Buffer, an ArrayBuffer, or a list of Buffers. Normalise to text. */
function toText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8');
  if (Array.isArray(raw)) {
    const chunks = raw.filter((chunk): chunk is Buffer => Buffer.isBuffer(chunk));
    return Buffer.concat(chunks).toString('utf8');
  }
  return '';
}

/**
 * Registers `/ws`.
 *
 * Which session a socket watches is `?session=<id>` for now. When the contract
 * grows the `session.open` command that ARCHITECTURE.md §5 describes, this moves
 * into a command and the query parameter goes away; nothing else changes.
 */
export function registerEventStream(
  app: FastifyInstance,
  broker: Broker,
  access: SessionAccess,
): void {
  app.get<{ Querystring: StreamQuery }>(
    '/ws',
    {
      websocket: true,
      // preValidation runs before the upgrade, so a request refused here never
      // becomes a socket, never reaches the broker, and never receives a frame.
      preValidation: async (request, reply) => {
        if (!request.principal) {
          return reply.status(401).send({ error: 'sign in first' });
        }
        const sessionId = request.query.session;
        if (!sessionId) {
          return reply.status(400).send({ error: 'session is required' });
        }
        // Signed in is not the same as entitled. Without this, a session id is
        // the whole credential: guess one and its live stream is yours.
        if (!(await access.canWatch(request.principal, sessionId))) {
          // 404 rather than 403 on purpose. Answering 403 for a session that
          // exists and 404 for one that does not would turn the status code
          // into an oracle for which ids are real.
          return reply.status(404).send({ error: 'no such session' });
        }
        return;
      },
    },
    (socket: WebSocket, request) => {
      // preValidation guarantees both; the types cannot see that.
      const principal = request.principal as Principal;
      const sessionId = request.query.session ?? '';
      const log = request.log;

      log.info(`ws: ${principal.accountId} opened session ${sessionId}`);

      // subscribe() returns the function that undoes it, and holding on to that
      // return value is the whole discipline here. Never calling it leaves the
      // listener in the broker forever, holding a socket that is already dead.
      const unsubscribe = broker.subscribe(sessionId, (event: ServerEvent) => {
        if (socket.readyState !== OPEN) return;
        socket.send(JSON.stringify(event));
      });

      socket.on('message', (raw: unknown) => {
        const command = parseCommand(toText(raw));
        if (!command) {
          log.warn('ws: dropped an unparseable frame');
          return;
        }
        // The session this socket may watch was settled at the upgrade. A
        // command naming a different one is a bug or an attack, and either way
        // the client-supplied field does not get to override the checked one.
        if ('sessionId' in command && command.sessionId !== sessionId) {
          log.warn('ws: dropped a command naming a session this socket did not open');
          return;
        }
        // A command carrying a taskId instead — task.steer, and steer.cancel
        // when it lands — is not covered by that check: this layer does not
        // know which session a task belongs to. The slice that claims such a
        // command owns that check, and must make it against the principal.
        broker.dispatch(command, principal).then(
          (handled) => {
            if (!handled) log.warn(`ws: no slice owns "${command.type}" yet`);
          },
          (error: unknown) => log.error({ err: error }, `ws: handler for "${command.type}" threw`),
        );
      });

      // Both paths must unsubscribe: a socket that errors does not always close.
      socket.on('close', () => {
        unsubscribe();
        log.info(`ws: session ${sessionId} disconnected`);
      });
      socket.on('error', () => unsubscribe());
    },
  );
}
