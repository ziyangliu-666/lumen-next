import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { UUID } from './validation.js';

export interface SecretContext {
  readonly accountId: string;
  readonly provider: string;
}
export interface SecretEnvelope {
  readonly version: 1;
  readonly keyId: string;
  readonly nonce: string;
  readonly ciphertext: string;
  readonly tag: string;
}
const MAX_BYTES = 16384;
const KEY_ID = /^[a-zA-Z0-9_-]{1,64}$/;

function binding(context: SecretContext, keyId: string): Buffer {
  if (!UUID.test(context.accountId) || !/^[a-z][a-z0-9-]{0,63}$/.test(context.provider))
    throw new Error('invalid secret context');
  // JSON avoids delimiter ambiguity. Bind both the destination and envelope header.
  return Buffer.from(
    JSON.stringify(['lumen-billing-secret', 1, keyId, context.accountId, context.provider]),
  );
}
function decode(value: unknown, length?: number): Buffer {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_BYTES / 3) * 4)
    throw new Error('invalid secret envelope');
  const bytes = Buffer.from(value, 'base64');
  if (
    !bytes.length ||
    bytes.length > MAX_BYTES ||
    bytes.toString('base64') !== value ||
    (length !== undefined && bytes.length !== length)
  )
    throw new Error('invalid secret envelope');
  return bytes;
}

/** Internal encryption boundary; no storage, HTTP, environment lookup or logging. */
export class SecretCipher {
  readonly #keys = new Map<string, KeyObject>();
  readonly #activeKeyId: string;

  constructor(activeKeyId: string, keys: ReadonlyMap<string, Uint8Array>) {
    if (!KEY_ID.test(activeKeyId) || !keys.has(activeKeyId))
      throw new Error('invalid secret encryption configuration');
    for (const [id, key] of keys) {
      if (!KEY_ID.test(id) || key.byteLength !== 32)
        throw new Error('invalid secret encryption configuration');
      this.#keys.set(id, createSecretKey(key));
    }
    this.#activeKeyId = activeKeyId;
  }

  seal(context: SecretContext, plaintext: string): SecretEnvelope {
    if (
      !plaintext.trim() ||
      Buffer.byteLength(plaintext) > MAX_BYTES ||
      Buffer.from(plaintext, 'utf8').toString('utf8') !== plaintext
    )
      throw new Error('invalid secret value');
    const aad = binding(context, this.#activeKeyId);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#keys.get(this.#activeKeyId)!, nonce, {
      authTagLength: 16,
    });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      version: 1,
      keyId: this.#activeKeyId,
      nonce: nonce.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  open(context: SecretContext, envelope: unknown): string {
    try {
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        !('version' in envelope) ||
        envelope.version !== 1 ||
        !('keyId' in envelope) ||
        typeof envelope.keyId !== 'string' ||
        !('nonce' in envelope) ||
        !('ciphertext' in envelope) ||
        !('tag' in envelope)
      )
        throw new Error('invalid secret envelope');
      const key = this.#keys.get(envelope.keyId);
      if (!key) throw new Error('unknown encryption key');
      const decipher = createDecipheriv('aes-256-gcm', key, decode(envelope.nonce, 12), {
        authTagLength: 16,
      });
      decipher.setAAD(binding(context, envelope.keyId));
      decipher.setAuthTag(decode(envelope.tag, 16));
      // Do not release plaintext from update() until final() authenticates it.
      const plaintext = Buffer.concat([
        decipher.update(decode(envelope.ciphertext)),
        decipher.final(),
      ]);
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(plaintext);
    } catch {
      // Never attach ciphertext, context, plaintext, keys or provider errors as a cause.
      throw new Error('stored secret could not be decrypted');
    }
  }
}
