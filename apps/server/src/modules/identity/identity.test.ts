import { describe, expect, it } from 'vitest';
import type { Principal } from '../../core/http/authGuard.js';
import { AbstractAuthFlow, type AuthStrategy } from './index.js';

class PasswordStrategy implements AuthStrategy {
  readonly kind = 'password' as const;
  verify(payload: Record<string, string>): Promise<Principal | null> {
    if (payload.email === 'a.li@example.edu' && payload.password === 'correct') {
      return Promise.resolve({ accountId: 'acc-1', role: 'user' });
    }
    return Promise.resolve(null);
  }
}

class Flow extends AbstractAuthFlow {
  protected strategies(): readonly AuthStrategy[] {
    return [new PasswordStrategy()];
  }
}

describe('identity: Strategy + Template Method', () => {
  it('authenticates a known password credential', async () => {
    const p = await new Flow().authenticate({
      kind: 'password',
      payload: { email: 'a.li@example.edu', password: 'correct' },
    });
    expect(p).toEqual({ accountId: 'acc-1', role: 'user' });
  });

  it('rejects an unknown strategy without touching any verify()', async () => {
    const p = await new Flow().authenticate({ kind: 'github', payload: {} });
    expect(p).toBeNull();
  });

  it.todo('GithubStrategy exchanges an OAuth code for a verified email');
  it.todo('SessionStrategy resolves an existing cookie to its principal');
});
