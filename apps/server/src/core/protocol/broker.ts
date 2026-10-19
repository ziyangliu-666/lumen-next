import type { ClientCommand, ServerEvent } from '@lumen/contracts';
import type { Principal } from '../http/authGuard.js';

// The broker is the only path from the monolith to the browser, in both
// directions.
//
// Down: a slice publishes to a session id; the broker fans the event out to the
// sockets watching that session and to no others. A slice never learns that a
// browser exists, and one session's events never reach another session's tab.
// Up: a slice claims a command type at startup; the broker routes each frame to
// the one handler that owns it.
//
// In memory, so it is per-process. A second instance needs a shared
// bus behind the same two methods; nothing above them changes.

export type Listener = (event: ServerEvent) => void;

export type CommandHandler<T extends ClientCommand['type'] = ClientCommand['type']> = (
  command: Extract<ClientCommand, { type: T }>,
  principal: Principal,
) => void | Promise<void>;

export class Broker {
  private readonly sessions = new Map<string, Set<Listener>>();
  private readonly handlers = new Map<ClientCommand['type'], CommandHandler>();

  /** Watch one session. The return value is the undo — call it on disconnect. */
  subscribe(sessionId: string, listener: Listener): () => void {
    const listeners = this.sessions.get(sessionId) ?? new Set<Listener>();
    listeners.add(listener);
    this.sessions.set(sessionId, listeners);

    return () => {
      const current = this.sessions.get(sessionId);
      if (!current) return;
      current.delete(listener);
      // Drop the empty set too, or a long-lived process accumulates one entry
      // for every session that has ever been opened.
      if (current.size === 0) this.sessions.delete(sessionId);
    };
  }

  publish(sessionId: string, event: ServerEvent): void {
    const listeners = this.sessions.get(sessionId);
    if (!listeners) return;
    // Copy first: a listener that unsubscribes while being notified would
    // otherwise mutate the set this loop is walking.
    for (const listener of [...listeners]) listener(event);
  }

  /** Claim a command type. Two owners for one type is a wiring bug, so it throws. */
  onCommand<T extends ClientCommand['type']>(type: T, handler: CommandHandler<T>): void {
    if (this.handlers.has(type)) {
      throw new Error(`broker: "${type}" already has a handler`);
    }
    this.handlers.set(type, (command, principal) =>
      // The map key is the command's own type, which is the narrowing the type
      // system cannot follow through the Map.
      handler(command as Extract<ClientCommand, { type: T }>, principal),
    );
  }

  /** False means no slice has claimed this command type yet. */
  async dispatch(command: ClientCommand, principal: Principal): Promise<boolean> {
    const handler = this.handlers.get(command.type);
    if (!handler) return false;
    await handler(command, principal);
    return true;
  }

  /** How many sockets watch a session. A gauge, and a leak detector in tests. */
  subscriberCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.size ?? 0;
  }
}
