import { costOf } from './pricing.js';
import {
  ModelError,
  type Completion,
  type ModelProvider,
  type ModelRequest,
  type StopReason,
  type ToolCall,
} from './provider.js';

// One adapter for every vendor that speaks OpenAI's chat completions: OpenAI
// itself, DeepSeek, and most others. What differs between them is a base URL,
// a key, and the name of the field that caps the answer. Nothing else is
// vendor-specific, so nothing else is configurable.

export type Fetch = typeof fetch;

export interface OpenAICompatibleOptions {
  /** 'openai' | 'deepseek' | … : the receipt's and the ledger's name for it. */
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /**
   * OpenAI renamed max_tokens to max_completion_tokens and refuses the old
   * name on its newer models; DeepSeek knows only the old one.
   */
  readonly maxTokensField?: 'max_tokens' | 'max_completion_tokens';
  readonly timeoutMs?: number;
  /** How many times a rate limit or a server error is tried again. */
  readonly retries?: number;
  /** For tests: no network. */
  readonly fetch?: Fetch;
  /** For tests: no waiting between retries. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 2;
/** Between retries: 1 s, 2 s, 4 s … capped, unless the vendor named a wait. */
const BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 8_000;

interface WireMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}

interface WireReply {
  model?: string;
  choices?: {
    finish_reason?: string;
    message?: {
      content?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

function toWire(request: ModelRequest): WireMessage[] {
  const wire: WireMessage[] = [{ role: 'system', content: request.system }];
  for (const message of request.messages) {
    if (message.role === 'tool') {
      wire.push({ role: 'tool', content: message.content, tool_call_id: message.toolCallId ?? '' });
    } else if (message.role === 'assistant' && message.toolCalls?.length) {
      wire.push({
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      });
    } else {
      wire.push({ role: message.role, content: message.content });
    }
  }
  return wire;
}

function stopReasonOf(finish: string | undefined, calls: number): StopReason {
  if (calls > 0 || finish === 'tool_calls') return 'tool';
  if (finish === 'length') return 'length';
  return 'end';
}

function kindOf(status: number): ModelError['kind'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  return 'bad-request';
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

export class OpenAICompatible implements ModelProvider {
  readonly name: string;
  readonly model: string;
  private readonly options: Required<
    Pick<OpenAICompatibleOptions, 'maxTokensField' | 'timeoutMs' | 'retries' | 'fetch' | 'sleep'>
  > &
    OpenAICompatibleOptions;

  constructor(options: OpenAICompatibleOptions) {
    if (!options.apiKey) throw new Error(`model ${options.name}: an API key is required`);
    this.name = options.name;
    this.model = options.model;
    this.options = {
      maxTokensField: 'max_completion_tokens',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: DEFAULT_RETRIES,
      fetch: globalThis.fetch,
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
      ...options,
    };
  }

  async complete(request: ModelRequest, signal?: AbortSignal): Promise<Completion> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toWire(request),
      [this.options.maxTokensField]: request.maxTokens,
    };
    if (request.temperature !== undefined) body['temperature'] = request.temperature;
    if (request.tools?.length) {
      body['tools'] = request.tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));
    }
    const startedAt = Date.now();
    const reply = await this.send(JSON.stringify(body), signal);
    return this.read(reply, Date.now() - startedAt);
  }

  /** One request with a timeout, tried again on what is worth trying again. */
  private async send(body: string, signal: AbortSignal | undefined): Promise<WireReply> {
    let attempt = 0;
    for (;;) {
      const timeout = AbortSignal.timeout(this.options.timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let response: Response;
      try {
        response = await this.options.fetch(`${this.options.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body,
          signal: combined,
        });
      } catch (error) {
        if (signal?.aborted) throw new ModelError('network', 'the call was cancelled');
        const failure = timeout.aborted
          ? new ModelError('timeout', `${this.name}: no answer in ${this.options.timeoutMs} ms`)
          : new ModelError('network', `${this.name}: ${(error as Error).message}`);
        if (failure.kind === 'network' && attempt < this.options.retries) {
          await this.wait(attempt++, null);
          continue;
        }
        throw failure;
      }

      if (response.ok) {
        try {
          return (await response.json()) as WireReply;
        } catch {
          throw new ModelError('malformed', `${this.name}: the answer was not JSON`);
        }
      }
      const kind = kindOf(response.status);
      const detail = await response.text().then(
        (text) => {
          try {
            return (JSON.parse(text) as WireReply).error?.message ?? text;
          } catch {
            return text;
          }
        },
        () => '',
      );
      const failure = new ModelError(
        kind,
        `${this.name}: HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
        response.status,
      );
      if (failure.retryable && attempt < this.options.retries) {
        await this.wait(attempt++, retryAfterMs(response));
        continue;
      }
      throw failure;
    }
  }

  private wait(attempt: number, named: number | null): Promise<void> {
    const ms = named ?? Math.min(BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    return this.options.sleep(ms);
  }

  private read(reply: WireReply, durationMs: number): Completion {
    const choice = reply.choices?.[0];
    const usage = reply.usage;
    if (!choice?.message || !usage) {
      throw new ModelError('malformed', `${this.name}: the answer had no choice or no usage`);
    }
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((call, index) => {
      const raw = call.function?.arguments ?? '{}';
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new ModelError('malformed', `${this.name}: tool call ${index} had invalid JSON`);
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ModelError(
          'malformed',
          `${this.name}: tool call ${index} arguments not an object`,
        );
      }
      return {
        id: call.id ?? `call_${index}`,
        name: call.function?.name ?? '',
        arguments: parsed as Record<string, unknown>,
      };
    });
    const counted = {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    };
    const model = reply.model ?? this.model;
    return {
      text: choice.message.content ?? '',
      toolCalls,
      stopReason: stopReasonOf(choice.finish_reason, toolCalls.length),
      usage: counted,
      cost: costOf(model, counted),
      model,
      durationMs,
    };
  }
}
