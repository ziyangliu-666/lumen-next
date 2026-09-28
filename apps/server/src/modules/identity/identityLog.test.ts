import { describe, expect, it } from 'vitest';
import { capture } from '../../core/log/testLog.js';
import { AuthFailure } from './authFlow.js';
import { logMailEvent, logRefusal } from './identityLog.js';
import { LoginLimited } from './loginGate.js';
import type { MailEvent } from './mailQueue.js';

describe('identity: log lines', () => {
  it('writes each mail event at the level docs/LOGGING.md gives it', () => {
    const { log, lines } = capture();
    const events: MailEvent[] = [
      'admitted',
      'sent',
      'dropped',
      'retry',
      'ineligible',
      'failed',
      'error',
    ];
    for (const event of events) logMailEvent(log, event);
    expect(lines().map((line) => [line['mail'], line['level']])).toEqual([
      ['admitted', 30],
      ['sent', 30],
      ['dropped', 40],
      ['retry', 40],
      ['ineligible', 40],
      ['failed', 50],
      ['error', 50],
    ]);
  });

  it('logs only a refusal or a rate limit, and nothing for any other error', () => {
    const { log, lines } = capture();
    logRefusal(log, 'password change', new AuthFailure('invalid_credentials'));
    logRefusal(log, 'password change', new LoginLimited());
    logRefusal(log, 'password change', new Error('user@example.edu is taken'));
    expect(lines()).toMatchObject([
      {
        level: 40,
        action: 'password change',
        reason: 'invalid_credentials',
        msg: 'identity refused',
      },
      { level: 40, action: 'password change', msg: 'identity rate-limited' },
    ]);
    expect(lines()).toHaveLength(2);
  });
});
