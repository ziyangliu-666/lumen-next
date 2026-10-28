#!/usr/bin/env node
// The literature watch: a second app on the Lumen platform.
// It uses only the public API v1 and an API key (docs/platform/public-api.md).
// No dependencies, so it runs from a ConfigMap in a stock node:22-alpine image.
//
//   LUMEN_URL=https://lumen.example LUMEN_API_KEY=lmn_... node watch.mjs
//
// Environment:
//   LUMEN_URL, LUMEN_API_KEY   required
//   WATCH_FILE                 the watch list, default ./watches.json
//   DIGEST_DIR                 also write <date>-<slug>.md files here
//   WATCH_POLL_MS              poll interval, default 3000
//   WATCH_TIMEOUT_MS           per topic, default 600000 (10 min)
//   WATCH_BACKOFF_MS           first retry delay on a network error, default 1000
//
// Exit codes: 0 every topic ended or stopped; 1 a topic failed, timed out or
// was refused; 2 configuration or authorization error.

import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AT_REST = new Set(['ended', 'stopped', 'failed']);
const NETWORK_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => process.stderr.write(`watch: ${message}\n`);

/** An error that ends the whole run with exit code 2. */
export class FatalError extends Error {}

export function readConfig(env = process.env) {
  const url = (env.LUMEN_URL ?? '').replace(/\/+$/, '');
  const apiKey = env.LUMEN_API_KEY ?? '';
  if (!url) throw new FatalError('Set LUMEN_URL, for example https://lumen.example.org');
  if (!apiKey) throw new FatalError('Set LUMEN_API_KEY to a key from POST /api/v1/keys');
  const number = (name, fallback) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isFinite(value) || value < 0) throw new FatalError(`${name} is not a number`);
    return value;
  };
  return {
    url,
    apiKey,
    watchFile: env.WATCH_FILE || './watches.json',
    digestDir: env.DIGEST_DIR || '',
    pollMs: number('WATCH_POLL_MS', 3000),
    timeoutMs: number('WATCH_TIMEOUT_MS', 600000),
    backoffMs: number('WATCH_BACKOFF_MS', 1000),
  };
}

/**
 * One call to the API. It waits out 429 (Retry-After) and retries network
 * errors and 5xx with backoff, because a cron run that dies on one blip
 * loses a whole day's digest. 401 and 403 are fatal: a retry cannot fix a key.
 * Other errors come back as { status, body } for the caller to judge.
 */
export async function api(config, method, path, body) {
  let failures = 0;
  for (;;) {
    let response;
    try {
      response = await fetch(config.url + path, {
        method,
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      failures += 1;
      if (failures > NETWORK_RETRIES) {
        throw new Error(`${method} ${path}: ${error.cause?.message ?? error.message}`);
      }
      const wait = config.backoffMs * 2 ** (failures - 1);
      log(`${method} ${path}: network error, retry ${failures} in ${wait} ms`);
      await sleep(wait);
      continue;
    }
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (response.status === 429) {
      // Retry-After is in seconds; without it, one second is a safe guess.
      const seconds = Number(response.headers.get('retry-after')) || 1;
      log(`${method} ${path}: rate limited, wait ${seconds} s`);
      await sleep(seconds * 1000);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      const reason = json?.error ?? response.statusText;
      throw new FatalError(
        `${method} ${path}: ${response.status} ${reason}. ` +
          (response.status === 401
            ? 'The API key is wrong or revoked.'
            : 'The API key lacks the scope for this call (see apps/watch/README.md).'),
      );
    }
    if (response.status >= 500 && failures < NETWORK_RETRIES) {
      failures += 1;
      const wait = config.backoffMs * 2 ** (failures - 1);
      log(`${method} ${path}: ${response.status}, retry ${failures} in ${wait} ms`);
      await sleep(wait);
      continue;
    }
    return { status: response.status, body: json };
  }
}

export function questionFor(topic) {
  return `What was published recently on ${topic}? List the papers with one line each.`;
}

export function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'topic'
  );
}

function formatCost(cost) {
  // The contract says dollars as a number; accept { dollars } as well.
  const dollars = typeof cost === 'number' ? cost : cost?.dollars;
  return typeof dollars === 'number' ? `$${dollars.toFixed(4)}` : 'unknown';
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function formatFinding(finding) {
  if (typeof finding === 'string') return finding;
  const title = finding?.title;
  const text = finding?.text ?? finding?.statement ?? finding?.claim ?? finding?.content;
  if (title && text) return `**${title}**: ${text}`;
  return title ?? text ?? JSON.stringify(finding);
}

/** The Markdown digest for one topic. */
export function renderDigest({ topic, agent, result, error, elapsedMs }) {
  const lines = [`# Literature watch: ${topic}`, '', `- Agent: ${agent}`];
  if (result) {
    const start = Date.parse(result.startedAt);
    const end = Date.parse(result.endedAt);
    // The server's clock is the better measure; ours includes polling slack.
    const taken = Number.isFinite(start) && Number.isFinite(end) ? end - start : elapsedMs;
    lines.push(
      `- Session: ${result.sessionId}`,
      `- Status: ${result.status}`,
      `- Cost: ${formatCost(result.cost)}`,
      `- Time taken: ${formatDuration(taken)}`,
      '',
      '## Answer',
      '',
      result.answer?.trim() || '_No answer._',
      '',
      '## Findings',
      '',
    );
    const findings = Array.isArray(result.findings) ? result.findings : [];
    if (findings.length === 0) lines.push('_No findings._');
    findings.forEach((finding, i) => lines.push(`${i + 1}. ${formatFinding(finding)}`));
  }
  if (error) lines.push(`- Error: ${error}`, `- Time taken: ${formatDuration(elapsedMs)}`);
  return lines.join('\n') + '\n';
}

/** Ask one question and poll until it is at rest. Returns { result } or { error }. */
export async function watchTopic(config, { topic, agent }) {
  const created = await api(config, 'POST', '/api/v1/questions', {
    question: questionFor(topic),
    agent,
  });
  if (created.status !== 201 && created.status !== 200) {
    return { error: `POST /api/v1/questions: ${created.status} ${created.body?.error ?? ''}` };
  }
  const { sessionId } = created.body;
  log(`${topic}: session ${sessionId}`);
  const deadline = Date.now() + config.timeoutMs;
  for (;;) {
    const polled = await api(config, 'GET', `/api/v1/questions/${encodeURIComponent(sessionId)}`);
    if (polled.status !== 200) {
      return { error: `GET /api/v1/questions/${sessionId}: ${polled.status}` };
    }
    if (AT_REST.has(polled.body.status)) return { result: polled.body };
    if (Date.now() + config.pollMs > deadline) {
      return {
        error: `session ${sessionId} not at rest after ${formatDuration(config.timeoutMs)}`,
      };
    }
    await sleep(config.pollMs);
  }
}

async function readWatches(file) {
  let watches;
  try {
    watches = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new FatalError(`Cannot read the watch list ${file}: ${error.message}`);
  }
  if (!Array.isArray(watches) || watches.some((w) => typeof w?.topic !== 'string' || !w.topic)) {
    throw new FatalError(`${file} must be a JSON list of { "topic": "...", "agent": "..." }`);
  }
  return watches.map((w) => ({ topic: w.topic, agent: w.agent || 'literature-scout' }));
}

export async function main(env = process.env) {
  try {
    const config = readConfig(env);
    const watches = await readWatches(config.watchFile);
    const date = new Date().toISOString().slice(0, 10);
    let ok = true;
    for (const watch of watches) {
      const started = Date.now();
      let outcome;
      try {
        outcome = await watchTopic(config, watch);
      } catch (error) {
        if (error instanceof FatalError) throw error;
        outcome = { error: error.message };
      }
      const digest = renderDigest({ ...watch, ...outcome, elapsedMs: Date.now() - started });
      process.stdout.write(digest + '\n');
      if (outcome.error || !['ended', 'stopped'].includes(outcome.result.status)) ok = false;
      if (config.digestDir) {
        await mkdir(config.digestDir, { recursive: true });
        await writeFile(join(config.digestDir, `${date}-${slugify(watch.topic)}.md`), digest);
      }
    }
    return ok ? 0 : 1;
  } catch (error) {
    log(error.message);
    return error instanceof FatalError ? 2 : 1;
  }
}

// Run only as a program, so publish-agent.mjs and the test can import from here.
// Compare real paths: a ConfigMap mounts the file through a symlink, and Node
// resolves the symlink in import.meta.url but not in argv[1].
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = await main();
  // fetch keeps idle sockets open for seconds; exit now, once stdout is flushed.
  process.stdout.write('', () => process.exit(code));
}
