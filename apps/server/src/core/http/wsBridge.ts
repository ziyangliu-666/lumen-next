import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ClientCommand, ServerEvent } from '@lumen/contracts';
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
 * Registers `/ws`. One socket per tab.
 *
 * A socket watches nothing until it says `session.open`. Each open is checked
 * against the principal, and a socket may watch several sessions. After a
 * dropped connection the browser connects again and says `session.open` again;
 * the snapshot that answers is how it catches up. There are no sequence
 * numbers: the snapshot is the durable record read back.
 *
 * `?session=<id>` still opens one session at the upgrade, so that an
 * older client keeps working.
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
        // Signed in is not the same as entitled. Without this, a session id is
        // the whole credential: guess one and its live stream is yours.
        if (sessionId && !(await access.canWatch(request.principal, sessionId))) {
          // 404 rather than 403 on purpose. Answering 403 for a session that
          // exists and 404 for one that does not would turn the status code
          // into an oracle for which ids are real.
          return reply.status(404).send({ error: 'no such session' });
        }
        return;
      },
    },
    (socket: WebSocket, request) => {
      // preValidation guarantees it; the types cannot see that.
      const principal = request.principal as Principal;
      const log = request.log;

      // What this socket watches: session id -> the function that undoes the
      // subscription. Holding on to that function is the whole discipline here.
      // Never calling it leaves the listener in the broker forever, holding a
      // socket that is already dead.
      const watching = new Map<string, () => void>();

      const send = (event: ServerEvent): void => {
        if (socket.readyState === OPEN) socket.send(JSON.stringify(event));
      };
      const watch = (sessionId: string): void => {
        if (watching.has(sessionId)) return;
        watching.set(sessionId, broker.subscribe(sessionId, send));
        log.info(`ws: ${principal.accountId} opened session ${sessionId}`);
      };
      const unwatchAll = (): void => {
        for (const unsubscribe of watching.values()) unsubscribe();
        watching.clear();
      };

      if (request.query.session) watch(request.query.session);

      const handle = async (command: ClientCommand): Promise<void> => {
        if (command.type === 'session.open') {
          if (!(await access.canWatch(principal, command.sessionId))) {
            // The same words for "not yours" and "not there", as at the upgrade.
            send({ type: 'error', message: 'no such session' });
            return;
          }
          // Subscribe first, then dispatch: the slice answers by publishing the
          // snapshot to the session, and this socket must already be listening.
          watch(command.sessionId);
        } else if ('sessionId' in command && !watching.has(command.sessionId)) {
          // A command for a session this socket has not opened is a bug or an
          // attack. Either way the client-supplied id does not get to skip the
          // check that session.open makes.
          log.warn('ws: dropped a command naming a session this socket did not open');
          return;
        }
        // A command carrying a taskId instead — task.steer, and steer.cancel
        // when it lands — is not covered by that check: this layer does not
        // know which session a task belongs to. The slice that claims such a
        // command owns that check, and must make it against the principal.
        const handled = await broker.dispatch(command, principal);
        if (command.type === 'session.close') {
          watching.get(command.sessionId)?.();
          watching.delete(command.sessionId);
        } else if (!handled) {
          log.warn(`ws: no slice owns "${command.type}" yet`);
        }
      };

      socket.on('message', (raw: unknown) => {
        const command = parseCommand(toText(raw));
        if (!command) {
          log.warn('ws: dropped an unparseable frame');
          return;
        }
        handle(command).catch((error: unknown) =>
          log.error({ err: error }, `ws: handler for "${command.type}" threw`),
        );
      });

      // Both paths must unsubscribe: a socket that errors does not always close.
      socket.on('close', () => {
        unwatchAll();
        log.info(`ws: ${principal.accountId} disconnected`);
      });
      socket.on('error', unwatchAll);
    },
  );
}
