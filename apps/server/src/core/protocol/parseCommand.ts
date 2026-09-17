import type { ClientCommand } from '@lumen/contracts';

// Nothing that arrives over a socket is trusted. This turns an unknown JSON
// frame into a ClientCommand or into null — there is no third outcome, and no
// `any` anywhere in between. Every field the contract promises is checked here,
// so a slice's command handler can read `command.text` without a guard.

/** A frame larger than this is a mistake or an attack, never a real command. */
const MAX_FRAME_BYTES = 64 * 1024;

const WHENS = ['end-of-turn', 'next-step'] as const;
type When = (typeof WHENS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-empty string, or null. Empty and whitespace-only are not commands. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function when(value: unknown): When | null {
  return WHENS.find((candidate) => candidate === value) ?? null;
}

export function parseCommand(raw: string): ClientCommand | null {
  // Bytes, not characters. `raw.length` counts UTF-16 code units, so a frame
  // of Chinese text would be measured at a third of what it costs to hold.
  if (Buffer.byteLength(raw, 'utf8') > MAX_FRAME_BYTES) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;

  switch (payload['type']) {
    case 'session.say': {
      const sessionId = text(payload['sessionId']);
      const body = text(payload['text']);
      if (!sessionId || !body) return null;
      return { type: 'session.say', sessionId, text: body };
    }
    case 'session.stop': {
      const sessionId = text(payload['sessionId']);
      if (!sessionId) return null;
      return { type: 'session.stop', sessionId };
    }
    case 'task.steer': {
      const taskId = text(payload['taskId']);
      const body = text(payload['text']);
      const at = when(payload['when']);
      if (!taskId || !body || !at) return null;
      return { type: 'task.steer', taskId, text: body, when: at };
    }
    default:
      return null;
  }
}
