import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ServerEvent } from '@lumen/contracts';
import type { Broker } from '../protocol/broker.js';
import { parseCommand } from '../protocol/parseCommand.js';
import type { Principal } from './authGuard.js';

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
export function registerEventStream(app: FastifyInstance, broker: Broker): void {
  app.get<{ Querystring: StreamQuery }>(
    '/ws',
    {
      websocket: true,
      // preValidation runs before the upgrade, so a request refused here never
      // becomes a socket and never reaches the broker at all.
      preValidation: (request, reply, done) => {
        if (!request.principal) {
          void reply.status(401).send({ error: 'sign in first' });
          return;
        }
        if (!request.query.session) {
          void reply.status(400).send({ error: 'session is required' });
          return;
        }
        done();
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
