import { describe, expect, it } from 'vitest';
import { parseCommand } from './parseCommand.js';

describe('core: parseCommand', () => {
  it('accepts each command the contract defines', () => {
    expect(parseCommand('{"type":"session.say","sessionId":"s1","text":"hello"}')).toEqual({
      type: 'session.say',
      sessionId: 's1',
      text: 'hello',
    });
    expect(parseCommand('{"type":"session.open","sessionId":"s1"}')).toEqual({
      type: 'session.open',
      sessionId: 's1',
    });
    expect(parseCommand('{"type":"session.close","sessionId":"s1"}')).toEqual({
      type: 'session.close',
      sessionId: 's1',
    });
    expect(parseCommand('{"type":"session.stop","sessionId":"s1"}')).toEqual({
      type: 'session.stop',
      sessionId: 's1',
    });
    expect(
      parseCommand('{"type":"task.steer","taskId":"t1","text":"go","when":"next-step"}'),
    ).toEqual({ type: 'task.steer', taskId: 't1', text: 'go', when: 'next-step' });
  });

  it('rejects anything that is not a command object', () => {
    expect(parseCommand('not json')).toBeNull();
    expect(parseCommand('"a string"')).toBeNull();
    expect(parseCommand('[1,2,3]')).toBeNull();
    expect(parseCommand('null')).toBeNull();
    expect(parseCommand('{"type":"task.delete","taskId":"t1"}')).toBeNull();
  });

  it('rejects a command missing or empty in a required field', () => {
    expect(parseCommand('{"type":"session.say","sessionId":"s1"}')).toBeNull();
    expect(parseCommand('{"type":"session.say","sessionId":"s1","text":"   "}')).toBeNull();
    expect(parseCommand('{"type":"session.say","sessionId":42,"text":"hi"}')).toBeNull();
    expect(parseCommand('{"type":"session.stop"}')).toBeNull();
  });

  it('rejects a steer aimed at a moment that does not exist', () => {
    expect(
      parseCommand('{"type":"task.steer","taskId":"t1","text":"go","when":"whenever"}'),
    ).toBeNull();
    expect(parseCommand('{"type":"task.steer","taskId":"t1","text":"go"}')).toBeNull();
  });

  it('rejects a frame too large to be a real command', () => {
    const huge = `{"type":"session.say","sessionId":"s1","text":"${'x'.repeat(70_000)}"}`;
    expect(parseCommand(huge)).toBeNull();
  });

  it('measures the frame in bytes, not in characters', () => {
    // 30k Chinese characters are 90k bytes of UTF-8 but only 30k code units,
    // so a length check would wave this through at under half the real cost.
    const wide = `{"type":"session.say","sessionId":"s1","text":"${'汉'.repeat(30_000)}"}`;
    expect(wide.length).toBeLessThan(64 * 1024);
    expect(Buffer.byteLength(wide, 'utf8')).toBeGreaterThan(64 * 1024);
    expect(parseCommand(wide)).toBeNull();
  });
});
