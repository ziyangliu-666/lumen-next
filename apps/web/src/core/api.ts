import type { ClientCommand, ServerEvent, SessionSnapshot, Step, Task } from '@lumen/contracts';

// The one door between the pages and the server: the REST calls, the socket,
// and the single reducer that applies a ServerEvent to the page's state. Both
// halves of the Session page read the state this produces; neither talks to
// the wire itself.

/**
 * Sprint 1 sign-in. The server trusts `stub <id>:<role>` in this cookie; the
 * real cookie from the identity slice replaces it and the rest of this file
 * does not change. A cookie rather than a header because the browser's
 * WebSocket API cannot set headers, and the event stream is authenticated
 * before the upgrade.
 */
const STUB_COOKIE = 'lumen_stub';

export function stubAccount(): string | null {
  const match = /(?:^|; )lumen_stub=stub ([^:;]+):/.exec(document.cookie);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

export function signInStub(accountId: string): void {
  const id = encodeURIComponent(accountId.trim());
  document.cookie = `${STUB_COOKIE}=stub ${id}:user; path=/; SameSite=Lax`;
}

/** The error body core sends: `{ error: string }`. */
async function failureOf(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new Error(body.error);
  } catch {
    // Not JSON; fall through to the status.
  }
  return new Error(`request failed with ${response.status}`);
}

export async function startSession(projectId: string, text: string): Promise<SessionSnapshot> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw await failureOf(response);
  return (await response.json()) as SessionSnapshot;
}

export async function fetchSession(sessionId: string): Promise<SessionSnapshot> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok) throw await failureOf(response);
  return (await response.json()) as SessionSnapshot;
}

// The page's state: the snapshot, kept current by the events.
export interface SessionState {
  readonly snapshot: SessionSnapshot;
  /** 'open' once the socket is live; the page shows it, nothing else reads it. */
  readonly stream: 'connecting' | 'open' | 'closed';
}

/** Apply one event. Unknown events are ignored, so an older page survives a newer server. */
export function apply(state: SessionState, event: ServerEvent): SessionState {
  const { snapshot } = state;
  switch (event.type) {
    case 'session.snapshot':
      // The whole record, read back. Replace, do not merge: after a dropped
      // connection this is what makes the page right again.
      return event.snapshot.session.id === snapshot.session.id
        ? { ...state, snapshot: event.snapshot }
        : state;
    case 'task.opened':
      // The snapshot may already hold it, if it was read after the event was sent.
      if (snapshot.tasks.some((task) => task.id === event.task.id)) return state;
      return { ...state, snapshot: { ...snapshot, tasks: [...snapshot.tasks, event.task] } };
    case 'task.status':
      return {
        ...state,
        snapshot: {
          ...snapshot,
          tasks: patchTask(snapshot.tasks, event.taskId, { status: event.status }),
        },
      };
    case 'task.cost':
      return {
        ...state,
        snapshot: {
          ...snapshot,
          tasks: patchTask(snapshot.tasks, event.taskId, { ownCost: event.ownCost }),
        },
      };
    case 'task.total': {
      const totals = { ...snapshot.totals, [event.taskId]: event.total };
      // The root's total is the session's spend; the server says so, the page does not add.
      const isRoot = snapshot.tasks.some((t) => t.id === event.taskId && t.parentId === null);
      const spend = isRoot ? event.total : snapshot.spend;
      return { ...state, snapshot: { ...snapshot, totals, spend } };
    }
    case 'step.appended': {
      const step: Step = {
        taskId: event.taskId,
        index: event.index,
        kind: event.kind,
        text: event.text,
      };
      // The snapshot may already hold this step if it was read after the event
      // was sent; the (task, index) pair says so.
      const seen = snapshot.steps.some((s) => s.taskId === step.taskId && s.index === step.index);
      return seen
        ? state
        : { ...state, snapshot: { ...snapshot, steps: [...snapshot.steps, step] } };
    }
    default:
      return state;
  }
}

/** The tasks in call-tree order: each parent, then its children, depth first. */
export function inTreeOrder(tasks: readonly Task[]): readonly Task[] {
  const under = (parentId: string | null): Task[] =>
    tasks.filter((task) => task.parentId === parentId).flatMap((task) => [task, ...under(task.id)]);
  return under(null);
}

function patchTask(tasks: readonly Task[], taskId: string, patch: Partial<Task>): readonly Task[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task));
}

export interface Stream {
  send(command: ClientCommand): void;
  close(): void;
}

/** How long to wait before connecting again: 0.5 s, doubling, never over 10 s. */
export function backoffMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt);
}

/**
 * Open the event stream for one session and keep it open. `onEvent` gets every
 * frame; `onState` the socket's own life.
 *
 * On every connection, the first and each one after a drop, it says
 * `session.open`, and the server answers with the snapshot. The events missed
 * while the socket was down are never replayed; the snapshot is how the page
 * catches up. `close()` is final: it also cancels a reconnect that is waiting.
 */
export function openStream(
  sessionId: string,
  onEvent: (event: ServerEvent) => void,
  onState: (state: SessionState['stream']) => void,
): Stream {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${scheme}://${window.location.host}/ws`;
  let socket: WebSocket | null = null;
  let timer: number | undefined;
  let attempt = 0;
  let closed = false;

  const connect = (): void => {
    onState('connecting');
    const current = new WebSocket(url);
    socket = current;
    current.addEventListener('open', () => {
      attempt = 0;
      current.send(JSON.stringify({ type: 'session.open', sessionId } satisfies ClientCommand));
      onState('open');
    });
    current.addEventListener('close', () => {
      if (closed) return;
      onState('closed');
      timer = window.setTimeout(connect, backoffMs(attempt));
      attempt += 1;
    });
    current.addEventListener('message', (frame: MessageEvent<string>) => {
      try {
        onEvent(JSON.parse(frame.data) as ServerEvent);
      } catch {
        // A frame that is not JSON is a server bug, not something the page can act on.
      }
    });
  };
  connect();

  return {
    send: (command) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command));
    },
    close: () => {
      closed = true;
      window.clearTimeout(timer);
      socket?.close();
    },
  };
}
