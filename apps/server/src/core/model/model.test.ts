import { describe, expect, it, vi } from 'vitest';
import { modelFromEnv, PROVIDERS } from './fromEnv.js';
import { nullModel } from './nullModel.js';
import { OpenAICompatible } from './openaiCompatible.js';
import { costOf, priceOf } from './pricing.js';
import { ModelError, type ModelRequest } from './provider.js';
import { withLog } from './logged.js';
import { capture } from '../log/testLog.js';

// No network here. Every answer is a recorded body, so what is tested is the
// adapter: what it sends, what it makes of an answer, and what it does when
// the vendor says no.

const ask: ModelRequest = {
  system: 'Answer in one word.',
  messages: [{ role: 'user', content: 'What colour is the sky?' }],
  maxTokens: 5,
};

const answer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  model: 'gpt-4.1-nano-2025-04-14',
  choices: [{ finish_reason: 'stop', message: { content: 'Blue.' } }],
  usage: { prompt_tokens: 20, completion_tokens: 2 },
  ...over,
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
}

/** An adapter over a scripted fetch. Each call takes the next response. */
function adapter(
  responses: (Response | Error)[],
  over: Partial<ConstructorParameters<typeof OpenAICompatible>[0]> = {},
): { provider: OpenAICompatible; calls: Call[] } {
  const calls: Call[] = [];
  const fetch = vi.fn((url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: url as string,
      body: JSON.parse(init?.body as string) as Record<string, unknown>,
      headers: new Headers(init?.headers),
    });
    const next = responses.shift();
    if (next === undefined) return Promise.reject(new Error('test: no more responses scripted'));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  const provider = new OpenAICompatible({
    name: 'openai',
    model: 'gpt-4.1-nano',
    baseUrl: 'https://example.test/v1',
    apiKey: 'sk-test',
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: () => Promise.resolve(),
    ...over,
  });
  return { provider, calls };
}

describe('core/model: pricing', () => {
  it('prices a call from its tokens, six decimals, and strips a vendor date suffix', () => {
    expect(costOf('gpt-4.1-nano-2025-04-14', { inputTokens: 1000, outputTokens: 500 })).toEqual({
      dollars: 0.0003,
    });
    expect(priceOf('deepseek-flash')).not.toBeNull();
  });

  it('refuses to price a model it has no row for, so an unpriced call is never charged as free', () => {
    expect(() => costOf('gpt-99', { inputTokens: 1, outputTokens: 1 })).toThrow(/no price/);
  });
});

describe('core/model: the OpenAI-compatible adapter', () => {
  it('sends the system line, the messages, the cap, and the key; and reads text, usage and cost', async () => {
    const { provider, calls } = adapter([json(answer())]);

    const reply = await provider.complete(ask);

    expect(calls[0]!.url).toBe('https://example.test/v1/chat/completions');
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer sk-test');
    expect(calls[0]!.body).toMatchObject({
      model: 'gpt-4.1-nano',
      max_completion_tokens: 5,
      messages: [
        { role: 'system', content: 'Answer in one word.' },
        { role: 'user', content: 'What colour is the sky?' },
      ],
    });
    expect(calls[0]!.body).not.toHaveProperty('temperature');
    expect(reply).toMatchObject({
      text: 'Blue.',
      stopReason: 'end',
      usage: { inputTokens: 20, outputTokens: 2 },
      cost: { dollars: 0.000003 },
      model: 'gpt-4.1-nano-2025-04-14',
    });
  });

  it('uses max_tokens for a vendor that only knows that name', async () => {
    const { provider, calls } = adapter([json(answer({ model: 'deepseek-flash' }))], {
      name: 'deepseek',
      model: 'deepseek-flash',
      maxTokensField: 'max_tokens',
    });
    await provider.complete(ask);
    expect(calls[0]!.body).toHaveProperty('max_tokens', 5);
    expect(calls[0]!.body).not.toHaveProperty('max_completion_tokens');
  });

  it('offers tools in the wire shape and reads a call back with its arguments parsed', async () => {
    const { provider, calls } = adapter([
      json(
        answer({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                content: null,
                tool_calls: [
                  { id: 'call_1', function: { name: 'search', arguments: '{"query":"sky"}' } },
                ],
              },
            },
          ],
        }),
      ),
    ]);
    const reply = await provider.complete({
      ...ask,
      tools: [{ name: 'search', description: 'look it up', parameters: { type: 'object' } }],
    });

    expect(calls[0]!.body['tools']).toEqual([
      {
        type: 'function',
        function: { name: 'search', description: 'look it up', parameters: { type: 'object' } },
      },
    ]);
    expect(reply.stopReason).toBe('tool');
    expect(reply.text).toBe('');
    expect(reply.toolCalls).toEqual([
      { id: 'call_1', name: 'search', arguments: { query: 'sky' } },
    ]);
  });

  it('replays an assistant turn with its tool calls and a tool result in the shape the vendor wants', async () => {
    const { provider, calls } = adapter([json(answer())]);
    await provider.complete({
      ...ask,
      messages: [
        { role: 'user', content: 'sky?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', name: 'search', arguments: { query: 'sky' } }],
        },
        { role: 'tool', content: 'blue', toolCallId: 'c1' },
      ],
    });
    const messages = calls[0]!.body['messages'] as Record<string, unknown>[];
    expect(messages[2]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'search', arguments: '{"query":"sky"}' } },
      ],
    });
    expect(messages[3]).toEqual({ role: 'tool', content: 'blue', tool_call_id: 'c1' });
  });

  it('says when the answer was cut by the cap', async () => {
    const { provider } = adapter([
      json(answer({ choices: [{ finish_reason: 'length', message: { content: 'Blu' } }] })),
    ]);
    expect((await provider.complete(ask)).stopReason).toBe('length');
  });

  it('tries a rate limit and a server error again, waiting what the vendor named, then answers', async () => {
    const waits: number[] = [];
    const { provider, calls } = adapter(
      [
        json({ error: { message: 'slow down' } }, 429, { 'retry-after': '3' }),
        json({ error: { message: 'oops' } }, 503),
        json(answer()),
      ],
      {
        sleep: (ms) => {
          waits.push(ms);
          return Promise.resolve();
        },
      },
    );
    const reply = await provider.complete(ask);

    expect(reply.text).toBe('Blue.');
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([3000, 2000]);
  });

  it('gives up after the retries and says why, with the vendor message', async () => {
    // The message is the last attempt's: that is the one the caller is told about.
    const { provider } = adapter([
      json({}, 500),
      json({}, 500),
      json({ error: { message: 'a' } }, 500),
    ]);
    const failure = await provider.complete(ask).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ModelError);
    expect((failure as ModelError).kind).toBe('server');
    expect((failure as ModelError).retryable).toBe(true);
    expect((failure as ModelError).message).toMatch(/HTTP 500: a/);
  });

  it('does not try a bad key or a bad request again: that needs a change, not time', async () => {
    for (const [status, kind] of [
      [401, 'auth'],
      [400, 'bad-request'],
    ] as const) {
      const { provider, calls } = adapter([json({ error: { message: 'no' } }, status)]);
      const failure = (await provider.complete(ask).catch((error: unknown) => error)) as ModelError;
      expect(failure.kind).toBe(kind);
      expect(failure.retryable).toBe(false);
      expect(calls).toHaveLength(1);
    }
  });

  it('tries the network once more, and names a timeout as a timeout', async () => {
    const { provider, calls } = adapter([new Error('ECONNRESET'), json(answer())]);
    expect((await provider.complete(ask)).text).toBe('Blue.');
    expect(calls).toHaveLength(2);

    const slow = new OpenAICompatible({
      name: 'openai',
      model: 'gpt-4.1-nano',
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      timeoutMs: 20,
      retries: 0,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });
    const failure = (await slow.complete(ask).catch((error: unknown) => error)) as ModelError;
    expect(failure.kind).toBe('timeout');
  });

  it('refuses an answer it cannot read rather than charging for it', async () => {
    for (const body of [
      { choices: [] },
      answer({ usage: undefined }),
      answer({
        choices: [
          { message: { tool_calls: [{ id: 'x', function: { name: 'f', arguments: '{' } }] } },
        ],
      }),
    ]) {
      const { provider } = adapter([json(body)]);
      const failure = (await provider.complete(ask).catch((error: unknown) => error)) as ModelError;
      expect(failure.kind).toBe('malformed');
    }
  });

  it('will not be built without a key', () => {
    expect(
      () => new OpenAICompatible({ name: 'openai', model: 'm', baseUrl: 'https://x', apiKey: '' }),
    ).toThrow(/API key/);
  });
});

describe('core/model: the process picks its provider from the environment', () => {
  it('runs on the null provider by default, which answers at once and costs nothing', async () => {
    expect(modelFromEnv({})).toBe(nullModel);
    const reply = await nullModel.complete(ask);
    expect(reply.cost).toEqual({ dollars: 0 });
    expect(reply.text).toContain('sky');
  });

  it('builds each vendor with its key and its cheapest model, and refuses a name it does not know', () => {
    const openai = modelFromEnv({ LUMEN_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'k' });
    expect([openai.name, openai.model]).toEqual(['openai', 'gpt-4.1-nano']);
    const deepseek = modelFromEnv({
      LUMEN_MODEL_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'k',
      LUMEN_MODEL: 'deepseek-v4-pro',
    });
    expect([deepseek.name, deepseek.model]).toEqual(['deepseek', 'deepseek-v4-pro']);
    expect(() => modelFromEnv({ LUMEN_MODEL_PROVIDER: 'anthropic' })).toThrow(PROVIDERS.join(', '));
    expect(() => modelFromEnv({ LUMEN_MODEL_PROVIDER: 'openai' })).toThrow(/API key/);
  });
});

describe('core/model: a call is logged, its text is not', () => {
  it('writes model, tokens, cost and duration for an answer, and the kind for a failure', async () => {
    const { log, lines } = capture();
    const { provider } = adapter([json(answer()), json({ error: { message: 'no' } }, 401)]);
    const logged = withLog(provider, log);

    await logged.complete(ask);
    await logged.complete(ask).catch(() => undefined);

    const [ok, failed] = lines();
    expect(ok).toMatchObject({
      provider: 'openai',
      model: 'gpt-4.1-nano-2025-04-14',
      inputTokens: 20,
      outputTokens: 2,
      cost: 0.000003,
      stopReason: 'end',
      msg: 'model call',
    });
    expect(failed).toMatchObject({
      provider: 'openai',
      kind: 'auth',
      status: 401,
      msg: 'model call failed',
    });
    expect(JSON.stringify(lines())).not.toMatch(/sky|Blue/);
  });
});
