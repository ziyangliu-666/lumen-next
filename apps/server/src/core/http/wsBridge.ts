import type { Server } from 'node:http';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import type { ServerEvent } from '@lumen/contracts';
import type { Broker } from '../protocol/broker.js';
import { parseCommand } from '../protocol/parseCommand.js';
import type { Principal, PrincipalResolver } from './authGuard.js';

// The seam between the domain and the wire. Above this file everything speaks
// ServerEvent and ClientCommand; below it, frames on a socket.
//
// `ws` is a protocol implementation, not an HTTP framework: node:http still
// owns the listener, and this attaches to its `upgrade` event.

/** WebSocket.OPEN. Inlined so the module does not import `ws` for one number. */
const OPEN = 1;

export interface EventStreamDeps {
  readonly broker: Broker;
  readonly resolver: PrincipalResolver;
  readonly log?: (message: string) => void;
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
 * Attaches `/ws` to a running http server. Returns the function that closes it.
 *
 * Which session a socket watches is `?session=<id>` for now. When the contract
 * grows the `session.open` command that ARCHITECTURE.md §5 describes, this moves
 * into a command and the query parameter goes away; nothing else changes.
 */
export function attachEventStream(server: Server, deps: EventStreamDeps): () => void {
  const log = deps.log ?? ((): void => {});
  const sockets = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://lumen.invalid');
    if (url.pathname !== '/ws') {
      // Not ours. Refuse rather than leave the socket hanging open.
      socket.destroy();
      return;
    }

    const sessionId = url.searchParams.get('session');
    if (!sessionId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Authenticate before the handshake, not after: an unauthenticated socket is
    // never upgraded, so it never reaches the broker at all.
    const header = request.headers.authorization;
    deps.resolver.resolve(header).then(
      (principal) => {
        if (!principal) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        sockets.handleUpgrade(request, socket, head, (ws) => {
          wire(ws, sessionId, principal, deps.broker, log);
        });
      },
      () => {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      },
    );
  });

  return () => sockets.close();
}

function wire(
  socket: WebSocket,
  sessionId: string,
  principal: Principal,
  broker: Broker,
  log: (message: string) => void,
): void {
  log(`ws: ${principal.accountId} opened session ${sessionId}`);

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
      log('ws: dropped an unparseable frame');
      return;
    }
    broker.dispatch(command, principal).then(
      (handled) => {
        if (!handled) log(`ws: no slice owns "${command.type}" yet`);
      },
      (error: unknown) => log(`ws: handler for "${command.type}" threw: ${String(error)}`),
    );
  });

  // Both paths must unsubscribe: a socket that errors does not always close.
  socket.on('close', () => {
    unsubscribe();
    log(`ws: session ${sessionId} disconnected`);
  });
  socket.on('error', () => unsubscribe());
}
