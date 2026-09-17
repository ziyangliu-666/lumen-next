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

/** Bounded local admission only; not a distributed or account-level limiter. */
export class LoginGate {
  private readonly peers = new Map<string, { count: number; expiresAt: number }>();
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

  async run<T>(peer: string, action: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) throw new LoginLimited();
    const now = this.now();
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(now + this.windowMs)) {
      throw new Error('Invalid login clock');
    }
    let entry = this.peers.get(peer);
    if (entry && entry.expiresAt <= now) {
      this.peers.delete(peer);
      entry = undefined;
    }
    if (!entry) {
      if (this.peers.size >= this.maxPeers) {
        for (const [key, value] of this.peers) {
          if (value.expiresAt <= now) this.peers.delete(key);
        }
      }
      if (this.peers.size >= this.maxPeers) throw new LoginLimited();
      entry = { count: 0, expiresAt: now + this.windowMs };
      this.peers.set(peer, entry);
    }
    if (entry.count >= this.attempts) throw new LoginLimited();
    entry.count += 1;
    this.active += 1;
    try {
      return await action();
    } finally {
      this.active -= 1;
    }
  }
}
