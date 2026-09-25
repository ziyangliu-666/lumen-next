export class LoginLimited extends Error {
  constructor() {
    super('Too many login attempts');
    this.name = 'LoginLimited';
  }
}

interface LoginLimits {
  /** Failures one account key may cause per window; the real defence. */
  readonly accountAttempts?: number;
  /** Failures one direct peer may cause per window, for requests with no account key. */
  readonly peerAttempts?: number;
  readonly windowMs?: number;
  readonly maxPeers?: number;
  readonly maxConcurrent?: number;
  /** Requests that may wait for a concurrency slot before any is refused. */
  readonly maxQueued?: number;
  readonly now?: () => number;
}
interface Bucket {
  count: number;
  expiresAt: number;
  active: number;
}

/**
 * Bounded process-local failure limits. A request that names an account is
 * limited by that account alone, so a failing client behind a shared proxy or
 * Docker bridge cannot lock out other users who arrive from the same address.
 * A request with no account key (reset codes, OAuth callbacks) is limited by
 * its direct peer, with a budget far above the account one.
 */
export class LoginGate {
  private readonly peers = new Map<string, Bucket>();
  private readonly waiting: (() => void)[] = [];
  private active = 0;
  private readonly accountAttempts: number;
  private readonly peerAttempts: number;
  private readonly windowMs: number;
  private readonly maxPeers: number;
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private readonly now: () => number;

  constructor(options: LoginLimits = {}) {
    this.accountAttempts = options.accountAttempts ?? 5;
    this.peerAttempts = options.peerAttempts ?? 100;
    this.windowMs = options.windowMs ?? 60_000;
    this.maxPeers = options.maxPeers ?? 10_000;
    this.maxConcurrent = options.maxConcurrent ?? 4;
    this.maxQueued = options.maxQueued ?? 64;
    this.now = options.now ?? Date.now;
    for (const value of [
      this.accountAttempts,
      this.peerAttempts,
      this.windowMs,
      this.maxPeers,
      this.maxConcurrent,
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid login limit');
    }
    if (!Number.isSafeInteger(this.maxQueued) || this.maxQueued < 0) {
      throw new Error('Invalid login limit');
    }
  }

  async run<T>(peer: string, action: () => Promise<T>, account?: string): Promise<T> {
    await this.acquire();
    try {
      return await this.admit(peer, action, account);
    } finally {
      this.release();
    }
  }

  private async admit<T>(peer: string, action: () => Promise<T>, account?: string): Promise<T> {
    const now = this.now();
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(now + this.windowMs)) {
      throw new Error('Invalid login clock');
    }
    const key = account === undefined ? `peer:${peer}` : `account:${account}`;
    const limit = account === undefined ? this.peerAttempts : this.accountAttempts;
    const existing = this.peers.get(key);
    if (existing && existing.expiresAt <= now && existing.active === 0) this.peers.delete(key);
    else if (existing && existing.count >= limit) throw new LoginLimited();
    if (!this.peers.has(key) && this.peers.size >= this.maxPeers) {
      for (const [stale, bucket] of this.peers) {
        if (bucket.expiresAt <= now && bucket.active === 0) this.peers.delete(stale);
      }
      if (this.peers.size >= this.maxPeers) throw new LoginLimited();
    }
    const bucket = this.peers.get(key) ?? { count: 0, expiresAt: now + this.windowMs, active: 0 };
    bucket.active += 1;
    this.peers.set(key, bucket);
    try {
      return await action();
    } catch (error) {
      bucket.count += 1;
      throw error;
    } finally {
      bucket.active -= 1;
      if (bucket.count === 0 && bucket.active === 0) this.peers.delete(key);
    }
  }

  /** Waits for a slot rather than refusing, until the queue itself is full. */
  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }
    if (this.waiting.length >= this.maxQueued) throw new LoginLimited();
    // release() hands its slot straight to the next waiter, so active is unchanged.
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active -= 1;
  }
}
