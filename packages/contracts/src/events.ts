import type { Money, Task, TaskStatus } from './tasks.js';

// Server -> browser. The broker streams these; the web client renders them.
// Every field here is a promise to five slices, so add, never repurpose.
export type ServerEvent =
  | { type: 'task.opened'; task: Task }
  | { type: 'task.status'; taskId: string; status: TaskStatus }
  | { type: 'task.cost'; taskId: string; ownCost: Money }
  | { type: 'step.appended'; taskId: string; index: number; text: string }
  | { type: 'finding.recorded'; taskId: string; findingId: string; text: string };

// Browser -> server.
export type ClientCommand =
  | { type: 'session.say'; sessionId: string; text: string }
  | { type: 'session.stop'; sessionId: string }
  | { type: 'task.steer'; taskId: string; text: string; when: 'end-of-turn' | 'next-step' };
