import { describe, expect, it, vi } from 'vitest';
import { LoginGate, LoginLimited } from './loginGate.js';

const wrong = (): Promise<never> => Promise.reject(new Error('wrong'));

describe('identity: login admission', () => {
  it('counts only failed attempts and resets only after the window', async () => {
    let now = 0;
    const gate = new LoginGate({ peerAttempts: 2, windowMs: 1000, now: () => now });
    await expect(gate.run('peer', () => Promise.resolve('ok'))).resolves.toBe('ok');
    const failure = new Error('bad credentials');
    await expect(gate.run('peer', () => Promise.reject(failure))).rejects.toBe(failure);
    await expect(gate.run('peer', () => Promise.reject(failure))).rejects.toBe(failure);
    const action = vi.fn(() => Promise.resolve());
    await expect(gate.run('peer', action)).rejects.toBeInstanceOf(LoginLimited);
    expect(action).not.toHaveBeenCalled();
    now = 1000;
    await gate.run('peer', action);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('bounds tracked keys without evicting active limits', async () => {
    let now = 0;
    const gate = new LoginGate({ peerAttempts: 1, maxPeers: 1, windowMs: 1000, now: () => now });
    await expect(gate.run('a', wrong)).rejects.toThrow('wrong');
    await expect(gate.run('b', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
    await expect(gate.run('a', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
    now = 1000;
    await expect(gate.run('b', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('lets other accounts behind the same proxy sign in after one account keeps failing', async () => {
    const gate = new LoginGate({ accountAttempts: 5, peerAttempts: 5 });
    for (let i = 0; i < 50; i++) {
      await expect(gate.run('proxy', wrong, 'attacked')).rejects.toBeDefined();
    }
    for (let i = 0; i < 10; i++) {
      await expect(gate.run('proxy', () => Promise.resolve('ok'), `user-${i}`)).resolves.toBe('ok');
    }
  });

  it('does not charge failures of named accounts to the shared peer budget', async () => {
    const gate = new LoginGate({ accountAttempts: 1, peerAttempts: 3 });
    for (let i = 0; i < 10; i++) {
      await expect(gate.run('proxy', wrong, `guess-${i}`)).rejects.toThrow('wrong');
    }
    await expect(gate.run('proxy', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('limits the same account across peers while keeping unrelated accounts usable', async () => {
    const gate = new LoginGate({ accountAttempts: 1 });
    await expect(gate.run('peer-a', wrong, 'same')).rejects.toThrow('wrong');
    await expect(gate.run('peer-b', () => Promise.resolve(), 'same')).rejects.toBeInstanceOf(
      LoginLimited,
    );
    await expect(gate.run('peer-b', () => Promise.resolve('ok'), 'different')).resolves.toBe('ok');
  });

  it('gives an unkeyed peer a budget far above an account by default', async () => {
    const gate = new LoginGate();
    for (let i = 0; i < 99; i++) await expect(gate.run('proxy', wrong)).rejects.toThrow('wrong');
    await expect(gate.run('proxy', () => Promise.resolve('ok'))).resolves.toBe('ok');
    await expect(gate.run('proxy', wrong)).rejects.toThrow('wrong');
    await expect(gate.run('proxy', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
  });

  it('queues work beyond the concurrency bound instead of refusing it', async () => {
    const gate = new LoginGate({ maxConcurrent: 1, maxQueued: 1 });
    let release = (): void => {
      throw new Error('not started');
    };
    const first = gate.run(
      'a',
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('first');
        }),
    );
    const queued = vi.fn(() => Promise.resolve('second'));
    const second = gate.run('b', queued);
    await Promise.resolve();
    expect(queued).not.toHaveBeenCalled();
    await expect(gate.run('c', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
    release();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    await expect(gate.run('c', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('releases concurrency capacity even when the action throws synchronously', async () => {
    const gate = new LoginGate({ maxConcurrent: 1, maxQueued: 0 });
    const failure = new Error('failure');
    await expect(
      gate.run('a', () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(gate.run('b', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it.each([
    { accountAttempts: 0 },
    { peerAttempts: 1.5 },
    { windowMs: -1 },
    { maxPeers: NaN },
    { maxConcurrent: 0.5 },
    { maxQueued: -1 },
  ])('rejects invalid limits: %j', (options) => {
    expect(() => new LoginGate(options)).toThrow('Invalid login limit');
  });
});
