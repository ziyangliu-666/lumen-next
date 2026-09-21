import { describe, expect, it, vi } from 'vitest';
import { LoginGate, LoginLimited } from './loginGate.js';

describe('identity: login admission', () => {
  it('counts only failed attempts and resets only after the window', async () => {
    let now = 0;
    const gate = new LoginGate({ attempts: 2, windowMs: 1000, now: () => now });
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

  it('bounds tracked peers without evicting active limits', async () => {
    let now = 0;
    const gate = new LoginGate({ attempts: 1, maxPeers: 1, windowMs: 1000, now: () => now });
    await expect(gate.run('a', () => Promise.reject(new Error('failure')))).rejects.toThrow(
      'failure',
    );
    await expect(gate.run('b', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
    await expect(gate.run('a', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
    now = 1000;
    await expect(gate.run('b', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('does not block successful accounts behind the same proxy', async () => {
    const gate = new LoginGate({ attempts: 1, maxPeers: 2 });
    for (let i = 0; i < 10; i++) {
      await expect(gate.run('proxy', () => Promise.resolve('ok'), `user-${i}`)).resolves.toBe('ok');
    }
  });

  it('limits the same account across peers while keeping unrelated accounts usable', async () => {
    const gate = new LoginGate({ attempts: 1 });
    await expect(
      gate.run('peer-a', () => Promise.reject(new Error('wrong')), 'same'),
    ).rejects.toThrow('wrong');
    await expect(gate.run('peer-b', () => Promise.resolve(), 'same')).rejects.toBeInstanceOf(
      LoginLimited,
    );
    await expect(gate.run('peer-b', () => Promise.resolve('ok'), 'different')).resolves.toBe('ok');
  });

  it('bounds concurrent work globally and releases capacity after completion', async () => {
    const gate = new LoginGate({ maxConcurrent: 1 });
    let release = (): void => {
      throw new Error('not started');
    };
    const waiting = gate.run(
      'a',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await expect(gate.run('b', () => Promise.resolve())).rejects.toBeInstanceOf(LoginLimited);
    release();
    await waiting;
    await expect(gate.run('b', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('releases concurrency capacity even when the action throws synchronously', async () => {
    const gate = new LoginGate({ maxConcurrent: 1 });
    const failure = new Error('failure');
    await expect(
      gate.run('a', () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(gate.run('b', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it.each([{ attempts: 0 }, { windowMs: -1 }, { maxPeers: NaN }, { maxConcurrent: 0.5 }])(
    'rejects invalid limits: %j',
    (options) => {
      expect(() => new LoginGate(options)).toThrow('Invalid login limit');
    },
  );
});
