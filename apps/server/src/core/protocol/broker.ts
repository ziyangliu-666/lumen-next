import type { ServerEvent } from '@lumen/contracts';

// The broker is the only path from the monolith to the browser. Slices publish
// domain events; the broker fans them out to connected clients as ServerEvents.
// Sprint 1: an in-memory pub/sub. LIU ZIYANG wires it to a WebSocket in core.
export type Listener = (event: ServerEvent) => void;

export class Broker {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: ServerEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
