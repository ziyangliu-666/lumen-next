// API keys for the public API v1 (docs/platform/public-api.md, "API keys").
//
// A key is `lmn_<prefix>_<secret>`. The database keeps the SHA-256 of the
// whole key and the prefix, never the key: it is shown once, at creation.
// withApiKeys puts the key in front of the cookie resolver that buildServer
// already runs, so a key and a cookie arrive at a handler as the same thing,
// a Principal. The guard (keyGuard.ts) then decides what the key may reach.
import { createHash, randomBytes } from 'node:crypto';
import type { Queryable } from '../../core/db/db.js';
import type { Credentials, Principal, PrincipalResolver } from '../../core/http/authGuard.js';
import type { Log } from '../../core/log/log.js';

export const SCOPES = [
  'agents:read',
  'agents:write',
  'questions:read',
  'questions:write',
  'usage:read',
] as const;
export type Scope = (typeof SCOPES)[number];

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const PREFIX_LENGTH = 8;
const SECRET_LENGTH = 32;
const KEY_FORMAT = /^lmn_([0-9A-Za-z]{8})_[0-9A-Za-z]{32}$/;
const BEARER = /^Bearer\s+(lmn_\S*)$/i;

/**
 * `length` base62 characters from the system's random source. A byte at or
 * over 248 is dropped: 248 is the largest multiple of 62 under 256, and a
 * plain modulo would make the first eight characters more likely.
 */
export function base62(length: number, random: (size: number) => Buffer = randomBytes): string {
  let out = '';
  while (out.length < length) {
    for (const byte of random(length * 2)) {
      if (byte >= 248) continue;
      out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export interface NewKey {
  /** The whole key. Shown once and never stored. */
  readonly key: string;
  readonly prefix: string;
  readonly hash: string;
}

export function generateKey(random?: (size: number) => Buffer): NewKey {
  const prefix = base62(PREFIX_LENGTH, random);
  const key = `lmn_${prefix}_${base62(SECRET_LENGTH, random)}`;
  return { key, prefix, hash: hashKey(key) };
}

/** Hex SHA-256 of the whole key. A key is 190 random bits, so no salt or slow hash is needed. */
export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function isKeyFormat(key: string): boolean {
  return KEY_FORMAT.test(key);
}

/**
 * The key in an Authorization header, or null when the header does not claim
 * to carry one. A header that starts with `Bearer lmn_` claims a key even if
 * the rest is malformed: that request is refused, not sent to the cookie.
 */
export function bearerKey(authorization: string | undefined): string | null {
  if (!authorization) return null;
  return BEARER.exec(authorization.trim())?.[1] ?? null;
}

export interface ApiKey {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: readonly Scope[];
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
}

/** A live key, with what the resolver needs to build its principal. */
export interface ActiveKey extends ApiKey {
  readonly role: Principal['role'];
}

export interface ApiKeyStore {
  create(input: {
    accountId: string;
    name: string;
    prefix: string;
    hash: string;
    scopes: readonly Scope[];
  }): Promise<ApiKey>;
  list(accountId: string): Promise<ApiKey[]>;
  /** False when the key is not this account's, or is already revoked. */
  revoke(accountId: string, id: string): Promise<boolean>;
  /** Only a key that is not revoked, of an account that is not suspended or deleted. */
  findActive(hash: string): Promise<ActiveKey | null>;
  /** Sets last_used_at, unless it was set less than a minute ago. */
  touch(id: string): Promise<void>;
}

const KEY_COLUMNS = `k.id, k.account_id as "accountId", k.name, k.prefix, k.scopes,
  k.created_at as "createdAt", k.last_used_at as "lastUsedAt", k.revoked_at as "revokedAt"`;

interface KeyRow {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: string[];
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly role?: Principal['role'];
}

function keyOfRow(row: KeyRow): ApiKey {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    prefix: row.prefix,
    // A scope this code no longer knows grants nothing.
    scopes: row.scopes.filter(isScope),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PgApiKeyStore implements ApiKeyStore {
  constructor(private readonly db: Queryable) {}

  async create(input: {
    accountId: string;
    name: string;
    prefix: string;
    hash: string;
    scopes: readonly Scope[];
  }): Promise<ApiKey> {
    const [row] = await this.db.query<KeyRow>(
      `insert into platform_api_keys as k (account_id, name, prefix, key_hash, scopes)
       values ($1, $2, $3, $4, $5) returning ${KEY_COLUMNS}`,
      [input.accountId, input.name, input.prefix, input.hash, [...input.scopes]],
    );
    return keyOfRow(row!);
  }

  async list(accountId: string): Promise<ApiKey[]> {
    if (!UUID.test(accountId)) return [];
    const rows = await this.db.query<KeyRow>(
      `select ${KEY_COLUMNS} from platform_api_keys k
        where k.account_id = $1 order by k.created_at desc, k.id`,
      [accountId],
    );
    return rows.map(keyOfRow);
  }

  async revoke(accountId: string, id: string): Promise<boolean> {
    if (!UUID.test(accountId) || !UUID.test(id)) return false;
    const rows = await this.db.query(
      `update platform_api_keys set revoked_at = now()
        where id = $1 and account_id = $2 and revoked_at is null returning id`,
      [id, accountId],
    );
    return rows.length > 0;
  }

  async findActive(hash: string): Promise<ActiveKey | null> {
    const [row] = await this.db.query<KeyRow>(
      `select ${KEY_COLUMNS}, a.role from platform_api_keys k
         join accounts a on a.id = k.account_id
        where k.key_hash = $1 and k.revoked_at is null
          and not a.suspended and a.deleted_at is null`,
      [hash],
    );
    return row ? { ...keyOfRow(row), role: row.role ?? 'user' } : null;
  }

  async touch(id: string): Promise<void> {
    await this.db.query(
      `update platform_api_keys set last_used_at = now()
        where id = $1 and (last_used_at is null or last_used_at < now() - interval '1 minute')`,
      [id],
    );
  }
}

const TOUCH_EVERY_MS = 60_000;

/** The cookie resolver with API keys in front of it. keyOf answers which key a principal came from. */
export interface ApiKeyResolver extends PrincipalResolver {
  keyOf(principal: Principal | null): ApiKey | null;
}

/**
 * Resolves `Authorization: Bearer lmn_...` to the key's account, and every
 * other request with the cookie resolver. A request that carries a key is
 * never resolved by its cookie: an unknown or revoked key is no principal at
 * all, and the guard answers 401.
 *
 * Each resolution builds a fresh Principal object and remembers its key in a
 * WeakMap, so the guard and the handlers learn the key's id and scopes from
 * request.principal with no second read, and nothing outlives the request.
 */
export function withApiKeys(
  cookies: PrincipalResolver,
  store: ApiKeyStore,
  log?: Log,
  now: () => number = Date.now,
): ApiKeyResolver {
  const keys = new WeakMap<Principal, ApiKey>();
  return {
    async resolve(from: Credentials): Promise<Principal | null> {
      const raw = bearerKey(from.authorization);
      if (raw === null) return cookies.resolve(from);
      if (!isKeyFormat(raw)) return null;
      const key = await store.findActive(hashKey(raw));
      if (!key) return null;
      const last = key.lastUsedAt === null ? 0 : Date.parse(key.lastUsedAt);
      if (now() - last >= TOUCH_EVERY_MS) {
        // Not awaited: the time a key was last used must never slow or fail a request.
        store.touch(key.id).catch((error: unknown) => {
          log?.warn({ err: error, keyId: key.id }, 'api key last_used_at not updated');
        });
      }
      const principal: Principal = { accountId: key.accountId, role: key.role };
      keys.set(principal, key);
      return principal;
    },
    keyOf: (principal) => (principal ? (keys.get(principal) ?? null) : null),
  };
}
