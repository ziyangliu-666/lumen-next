import type { SessionSnapshot, StepDetail, StepKind } from './sessions.js';
import type { Money, Task, TaskStatus } from './tasks.js';

// Server -> browser. The broker streams these; the web client renders them.
// Every field here is a promise to five slices, so add, never repurpose.
export type ServerEvent =
  // The answer to session.open: everything about the session so far. The page
  // replaces its state with it, which is also how a reconnect catches up.
  | { type: 'session.snapshot'; snapshot: SessionSnapshot }
  | { type: 'task.opened'; task: Task }
  | { type: 'task.status'; taskId: string; status: TaskStatus }
  | { type: 'task.cost'; taskId: string; ownCost: Money }
  // The task's cost with every descendant rolled up. Sent for the task that
  // spent and for each of its ancestors, because the browser never adds.
  | { type: 'task.total'; taskId: string; total: Money }
  | {
      type: 'step.appended';
      taskId: string;
      index: number;
      kind: StepKind;
      text: string;
      detail?: StepDetail;
    }
  // The text a model has written so far in the call in flight, sent as it
  // arrives so the page can draw the answer word by word. Not recorded: the
  // step.appended that follows for the same task replaces it, and a page
  // that missed a draft only misses the animation.
  | { type: 'step.draft'; taskId: string; text: string }
  // The session's short name, written once after its first question.
  | { type: 'session.titled'; sessionId: string; title: string }
  | { type: 'finding.recorded'; taskId: string; findingId: string; text: string; title?: string }
  // A command this socket sent could not be carried out. Says why in words a
  // user may read; never anything about the server's insides.
  | { type: 'error'; message: string };

// Browser -> server.
export type ClientCommand =
  // Watch a session on this socket, and be sent its snapshot. One socket per
  // tab may watch several sessions; each is checked against the principal.
  | { type: 'session.open'; sessionId: string }
  | { type: 'session.close'; sessionId: string }
  // `model`: the model from this turn on. `edit`: the text replaces the
  // person's latest message, and the turn after it, instead of following it.
  | { type: 'session.say'; sessionId: string; text: string; model?: string; edit?: boolean }
  | { type: 'session.stop'; sessionId: string }
  | { type: 'task.steer'; taskId: string; text: string; when: 'end-of-turn' | 'next-step' };
