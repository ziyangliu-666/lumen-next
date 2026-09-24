import { describe, expect, it } from 'vitest';
import { createLog, nullLog, taskLog } from './log.js';
import { capture } from './testLog.js';

describe('core/log', () => {
  it('writes a credential as [redacted], at the top of a line and one level down', () => {
    const { log, lines } = capture();
    log.info(
      {
        apiKey: 'sk-live',
        password: 'hunter2',
        req: { headers: { authorization: 'Bearer x', cookie: 'lumen=abc', accept: 'json' } },
        vendor: { token: 't', name: 'openai' },
      },
      'signing in',
    );
    const [line] = lines();
    expect(line).toMatchObject({
      apiKey: '[redacted]',
      password: '[redacted]',
      req: { headers: { authorization: '[redacted]', cookie: '[redacted]', accept: 'json' } },
      vendor: { token: '[redacted]', name: 'openai' },
      msg: 'signing in',
    });
    expect(JSON.stringify(line)).not.toMatch(/sk-live|hunter2|Bearer x|lumen=abc/);
  });

  it('gives a task run a child whose every line carries the ids', () => {
    const { log, lines } = capture();
    const child = taskLog(log, { sessionId: 's1', taskId: 't1', accountId: 'a1' });
    child.info('task started');
    child.child({ step: 3 }).warn('slow');
    expect(lines()).toMatchObject([
      { sessionId: 's1', taskId: 't1', accountId: 'a1', msg: 'task started' },
      { sessionId: 's1', taskId: 't1', accountId: 'a1', step: 3, msg: 'slow' },
    ]);
  });

  it('builds at the level asked, and the null log writes nothing', () => {
    expect(createLog({ level: 'warn' }).level).toBe('warn');
    expect(nullLog.level).toBe('silent');
  });
});
