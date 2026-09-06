import type { EdgeKind, Money, PointStatus } from './points.js';

// Server -> browser. The broker streams these; the web client renders them.
// Every field here is a promise to five slices, so add, never repurpose.
export type ServerEvent =
  | { type: 'point.opened'; pointId: string; parentId: string | null; edge: EdgeKind | null }
  | { type: 'point.status'; pointId: string; status: PointStatus }
  | { type: 'point.cost'; pointId: string; ownCost: Money }
  | { type: 'step.appended'; pointId: string; index: number; text: string }
  | { type: 'finding.recorded'; pointId: string; findingId: string; text: string };

// Browser -> server.
export type ClientCommand =
  | { type: 'session.say'; sessionId: string; text: string }
  | { type: 'session.stop'; sessionId: string }
  | { type: 'point.steer'; pointId: string; text: string; when: 'end-of-turn' | 'next-step' };
