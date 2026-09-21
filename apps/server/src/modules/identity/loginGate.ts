export class LoginLimited extends Error {
  constructor() {
    super('Too many login attempts');
    this.name = 'LoginLimited';
  }
}

interface LoginLimits {
  readonly attempts?: number;
  readonly windowMs?: number;
  readonly maxPeers?: number;
  readonly maxConcurrent?: number;
  readonly now?: () => number;
}
interface Bucket {
  count: number;
  expiresAt: number;
  active: number;
}

/** Bounded process-local failure limits per direct peer and optional account key. */
export class LoginGate {
  private readonly peers = new Map<string, Bucket>();
  private active = 0;
  private readonly attempts: number;
  private readonly windowMs: number;
  private readonly maxPeers: number;
  private readonly maxConcurrent: number;
  private readonly now: () => number;

  constructor(options: LoginLimits = {}) {
    this.attempts = options.attempts ?? 5;
    this.windowMs = options.windowMs ?? 60_000;
    this.maxPeers = options.maxPeers ?? 10_000;
    this.maxConcurrent = options.maxConcurrent ?? 4;
    this.now = options.now ?? Date.now;
    for (const value of [this.attempts, this.windowMs, this.maxPeers, this.maxConcurrent]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid login limit');
    }
  }

  async run<T>(peer: string, action: () => Promise<T>, account?: string): Promise<T> {
    if (this.active >= this.maxConcurrent) throw new LoginLimited();
    const now = this.now();
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(now + this.windowMs)) {
      throw new Error('Invalid login clock');
    }
    const keys = [`peer:${peer}`, ...(account === undefined ? [] : [`account:${account}`])];
    for (const key of keys) {
      const bucket = this.peers.get(key);
      if (bucket && bucket.expiresAt <= now && bucket.active === 0) this.peers.delete(key);
      else if (bucket && bucket.count >= this.attempts) throw new LoginLimited();
    }
    const missing = keys.filter((key) => !this.peers.has(key)).length;
    if (this.peers.size + missing > this.maxPeers) {
      for (const [key, bucket] of this.peers) {
        if (bucket.expiresAt <= now && bucket.active === 0) this.peers.delete(key);
      }
      if (this.peers.size + missing > this.maxPeers) throw new LoginLimited();
    }
    const entries = keys.map((key) => {
      const bucket = this.peers.get(key) ?? { count: 0, expiresAt: now + this.windowMs, active: 0 };
      bucket.active += 1;
      this.peers.set(key, bucket);
      return { key, bucket };
    });
    this.active += 1;
    try {
      return await action();
    } catch (error) {
      for (const { bucket } of entries) bucket.count += 1;
      throw error;
    } finally {
      this.active -= 1;
      for (const { key, bucket } of entries) {
        bucket.active -= 1;
        if (bucket.count === 0 && bucket.active === 0) this.peers.delete(key);
      }
    }
  }
}
