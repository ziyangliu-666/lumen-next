import type { Log } from '../../core/log/log.js';
import { AuthFailure } from './authFlow.js';
import { LoginLimited } from './loginGate.js';
import type { MailEvent } from './mailQueue.js';

// docs/LOGGING.md: warn is refused, dropped or retried; error is somebody has to look.
// A line carries a fixed reason and never a value from the request: no address,
// password, code, token, cookie or provider text.

const mailLevels: Record<MailEvent, 'info' | 'warn' | 'error'> = {
  admitted: 'info',
  sent: 'info',
  dropped: 'warn',
  retry: 'warn',
  ineligible: 'warn',
  failed: 'error',
  error: 'error',
};

export function logMailEvent(log: Log, event: MailEvent): void {
  log[mailLevels[event]]({ mail: event }, `mail ${event}`);
}

/** One warn line when a sign-in or an account action is refused or rate-limited. */
export function logRefusal(log: Log, action: string, error: unknown): void {
  if (error instanceof AuthFailure) log.warn({ action, reason: error.code }, 'identity refused');
  else if (error instanceof LoginLimited) log.warn({ action }, 'identity rate-limited');
}
