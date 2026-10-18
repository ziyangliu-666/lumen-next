import type {
  ClientCommand,
  ServerEvent,
  SessionMode,
  SessionSnapshot,
  Task,
} from '@lumen/contracts';

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

// Every reader of the current account (the bar, the page) listens for this
// event. Without it, the bar kept saying "Sign in" after the landing had
// switched the account, until the next reload.
function announceAuthChange(): void {
  window.dispatchEvent(new Event('lumen:auth-changed'));
}

export function signInStub(accountId: string): void {
  const id = encodeURIComponent(accountId.trim());
  document.cookie = `${STUB_COOKIE}=stub ${id}:user; path=/; SameSite=Lax`;
  announceAuthChange();
}

/** Drops the development account. The server has no session to end for it. */
export function signOutStub(): void {
  document.cookie = `${STUB_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  announceAuthChange();
}

/** A response that was not 2xx. Carries the status, so a page can tell 401 from 500. */
export class RequestFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RequestFailure';
  }
}

/** The error body core sends is `{ error: string }`. Anything else falls back to the status. */
async function failureOf(response: Response): Promise<RequestFailure> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return new RequestFailure(response.status, body.error);
  } catch {
    // Not JSON; fall through to the status.
  }
  return new RequestFailure(response.status, `request failed with ${response.status}`);
}

/**
 * The one way a page talks to `/api`: same origin, JSON in, JSON out, and a
 * RequestFailure for anything that is not 2xx. A page does not call fetch
 * itself, so that there is one place to add what every request needs.
 */
export async function request<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(url, {
    ...rest,
    ...(json === undefined
      ? {}
      : {
          method: rest.method ?? 'POST',
          headers: { ...rest.headers, 'content-type': 'application/json' },
          body: JSON.stringify(json),
        }),
  });
  if (!response.ok) throw await failureOf(response);
  // 204 and friends have no body to parse.
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function startSession(
  projectId: string,
  text: string,
  mode?: SessionMode,
): Promise<SessionSnapshot> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/sessions`, {
    json: mode ? { text, mode } : { text },
  });
}

export function fetchSession(sessionId: string): Promise<SessionSnapshot> {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

// The page's state: the snapshot, kept current by the events.
/** A finding as the Session page lists it. The record itself is the projects slice's. */
export interface SessionFinding {
  readonly id: string;
  readonly taskId: string;
  readonly text: string;
  /**
   * When it was recorded, in ms, for a finding read from the list. One from
   * `finding.recorded` has none (the event carries no time) and counts as
   * the newest. It only orders the list.
   */
  readonly createdAt?: number;
}

export interface SessionState {
  readonly snapshot: SessionSnapshot;
  /**
   * What the session has kept so far, oldest first. Not part of the snapshot:
   * findings belong to projects, so the page reads them from there once and
   * then keeps the list current from `finding.recorded`.
   */
  readonly findings: readonly SessionFinding[];
  /**
   * The text each task's model is writing now, by task id, from `step.draft`.
   * Gone once the step it becomes is appended, or the task stops running.
   */
  readonly drafts?: Readonly<Record<string, string>>;
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
        ? { ...state, snapshot: event.snapshot, drafts: {} }
        : state;
    case 'task.opened':
      // The snapshot may already hold it, if it was read after the event was sent.
      if (snapshot.tasks.some((task) => task.id === event.task.id)) return state;
      return { ...state, snapshot: { ...snapshot, tasks: [...snapshot.tasks, event.task] } };
    case 'task.status': {
      // The event says the status; when it ended follows from it. A task that
      // runs again (a new turn on the lead) is no longer ended, and one that has
      // just ended did so now, near enough for a clock in a header. The next
      // snapshot brings the server's own time.
      const ended = ['ended', 'stopped', 'failed'].includes(event.status);
      const patch = { status: event.status, endedAt: ended ? Date.now() : null };
      return {
        ...state,
        snapshot: { ...snapshot, tasks: patchTask(snapshot.tasks, event.taskId, patch) },
        // A stopped task keeps its draft, frozen, until the reply that keeps
        // it lands: it vanished at the stop and came back seconds later. A
        // new turn starts with none.
        ...(event.status === 'stopped' ? {} : { drafts: without(state.drafts, event.taskId) }),
      };
    }
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
      // Everything but the event's own `type`. Copying the fields one by one
      // dropped `detail` the day the contract gained it, and the page drew bare
      // steps while the record held full ones.
      const { type: _type, ...step } = event;
      // The snapshot may already hold this step if it was read after the event
      // was sent; the (task, index) pair says so.
      const seen = snapshot.steps.some((s) => s.taskId === step.taskId && s.index === step.index);
      // The step is what the draft was becoming: it takes the draft's place.
      return seen
        ? state
        : {
            ...state,
            snapshot: { ...snapshot, steps: [...snapshot.steps, step] },
            drafts: without(state.drafts, step.taskId),
          };
    }
    case 'step.draft':
      // Only a running task writes; frames still on the way after a stop
      // would grow a text the person has already stopped.
      if (!snapshot.tasks.some((task) => task.id === event.taskId && task.status === 'running')) {
        return state;
      }
      return { ...state, drafts: { ...state.drafts, [event.taskId]: event.text } };
    case 'finding.recorded': {
      // The first read of the list may already hold it.
      if (state.findings.some((finding) => finding.id === event.findingId)) return state;
      const finding = { id: event.findingId, taskId: event.taskId, text: event.text };
      return { ...state, findings: [...state.findings, finding] };
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

function without(drafts: SessionState['drafts'], taskId: string): Readonly<Record<string, string>> {
  if (!drafts || !(taskId in drafts)) return drafts ?? {};
  const { [taskId]: _gone, ...rest } = drafts;
  return rest;
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
