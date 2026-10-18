import type { Money } from '@lumen/contracts';

// The one door to a language model. A worker asks a ModelProvider and gets an
// answer with what it cost; it never sees an HTTP client, a key or a vendor's
// wire format. Every vendor is an adapter behind this interface, and a worker
// written against it runs on any of them, including the one that does nothing.
//
// Shared by two slices without either importing the other: steering's worker
// calls it, billing's Settings page will supply the key. It lives in core for
// the same reason worker.ts does.

export type Role = 'user' | 'assistant' | 'tool';

export interface Message {
  readonly role: Role;
  readonly content: string;
  /** On a 'tool' message: which call this is the result of. */
  readonly toolCallId?: string;
  /** On an 'assistant' message: the calls it made, replayed so the model sees its own turn. */
  readonly toolCalls?: readonly ToolCall[];
}

/** A function the model may call. `parameters` is a JSON Schema object. */
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  /** Parsed from the model's JSON. Invalid JSON is a ModelError, not a call. */
  readonly arguments: Record<string, unknown>;
}

export interface ModelRequest {
  readonly system: string;
  readonly messages: readonly Message[];
  readonly tools?: readonly Tool[];
  /** Hard cap on the answer. Every request has one: an unbounded answer is an unbounded bill. */
  readonly maxTokens: number;
  readonly temperature?: number;
  /**
   * Called with the text written so far, as it arrives, when the vendor can
   * stream. An adapter that cannot stream never calls it; the completion is
   * the same either way.
   */
  readonly onText?: (text: string) => void;
}

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type StopReason = 'end' | 'tool' | 'length';

export interface Completion {
  /** The text of the answer; empty when the model only called tools. */
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  readonly stopReason: StopReason;
  readonly usage: Usage;
  /** Priced from `usage` by the adapter, six decimals, ready for appendStep's detail.cost. */
  readonly cost: Money;
  /** The model that answered, as the vendor names it, for the receipt on the page. */
  readonly model: string;
  readonly durationMs: number;
}

export interface ModelProvider {
  /** For the receipt and the ledger reason: 'openai', 'deepseek', 'none'. */
  readonly name: string;
  readonly model: string;
  complete(request: ModelRequest, signal?: AbortSignal): Promise<Completion>;
}

/**
 * Why a call failed, in the terms a worker can act on. `retryable` is the
 * adapter's verdict after it has already retried what is worth retrying: a
 * true here means "later, not now", a false means "not without a change".
 */
export type ModelErrorKind =
  | 'auth' // the key is wrong or revoked
  | 'rate-limit' // the vendor said slow down and kept saying it
  | 'bad-request' // our request: a model name, a schema, a message shape
  | 'server' // the vendor's side
  | 'network' // no answer at all
  | 'timeout' // no answer in time
  | 'malformed'; // an answer we could not read

export class ModelError extends Error {
  constructor(
    readonly kind: ModelErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ModelError';
  }

  get retryable(): boolean {
    return this.kind === 'rate-limit' || this.kind === 'server' || this.kind === 'network';
  }
}
