// Runs watch.mjs as a child process against a fake platform (node:http) that
// implements the two endpoints the watch uses. Run: node --test apps/watch/
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const WATCH = fileURLToPath(new URL('./watch.mjs', import.meta.url));
const KEY = 'lmn_testtest_00000000000000000000000000000000';

/**
 * A fake platform. Each question is "running" for two polls, then "ended".
 * The first POST gets a 429, so the test sees Retry-After honoured.
 */
function fakePlatform({ limitFirstPost = true, finalStatus = 'ended' } = {}) {
  const calls = [];
  const sessions = new Map();
  let posts = 0;
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      calls.push(`${req.method} ${req.url}`);
      const send = (status, body, headers = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (req.headers.authorization !== `Bearer ${KEY}`) return send(401, { error: 'bad key' });
      if (req.method === 'POST' && req.url === '/api/v1/questions') {
        posts += 1;
        if (limitFirstPost && posts === 1) {
          return send(429, { error: 'rate limited' }, { 'retry-after': '1' });
        }
        const { question, agent } = JSON.parse(raw);
        const sessionId = `s-${posts}`;
        sessions.set(sessionId, { question, agent, polls: 0 });
        return send(201, { sessionId, projectId: `p-${posts}`, agent });
      }
      const match = /^\/api\/v1\/questions\/([^/]+)$/.exec(req.url);
      if (req.method === 'GET' && match && sessions.has(match[1])) {
        const s = sessions.get(match[1]);
        s.polls += 1;
        const done = s.polls >= 3;
        return send(200, {
          sessionId: match[1],
          status: done ? finalStatus : 'running',
          agent: s.agent,
          answer: done
            ? `1. A paper on ${s.question.slice(32, 60)}... (2026), arxiv.org/abs/2601.00001`
            : null,
          findings: done
            ? [{ title: 'Survey', text: 'One survey covers the field.' }, 'A plain finding.']
            : [],
          cost: done ? 0.0123 : 0.001,
          startedAt: '2026-10-20T08:00:00.000Z',
          endedAt: done ? '2026-10-20T08:02:05.000Z' : null,
        });
      }
      return send(404, { error: 'not found' });
    });
  });
  return { server, calls };
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

function runWatch(env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [WATCH],
      { env: { PATH: process.env.PATH, WATCH_POLL_MS: '50', WATCH_BACKOFF_MS: '20', ...env } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

let dir;
let watchFile;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'watch-test-'));
  watchFile = join(dir, 'watches.json');
  await writeFile(
    watchFile,
    JSON.stringify([
      { topic: 'Pattern avoidance in permutations', agent: 'literature-scout' },
      { topic: 'Graph neural networks' },
    ]),
  );
});
after(() => rm(dir, { recursive: true, force: true }));

test('asks each topic, waits out a 429, polls to rest, prints and writes the digest', async () => {
  const { server, calls } = fakePlatform();
  const url = await listen(server);
  const digestDir = join(dir, 'digests');
  try {
    const run = await runWatch({
      LUMEN_URL: url + '/',
      LUMEN_API_KEY: KEY,
      WATCH_FILE: watchFile,
      DIGEST_DIR: digestDir,
    });
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stderr, /rate limited, wait 1 s/);
    // 429 then 201 for the first topic, 201 for the second; three polls each.
    assert.equal(calls.filter((c) => c === 'POST /api/v1/questions').length, 3);
    assert.equal(calls.filter((c) => c.startsWith('GET /api/v1/questions/s-2')).length, 3);
    assert.match(run.stdout, /# Literature watch: Pattern avoidance in permutations/);
    assert.match(run.stdout, /- Agent: literature-scout/);
    assert.match(run.stdout, /- Cost: \$0\.0123/);
    assert.match(run.stdout, /- Time taken: 2 min 5 s/);
    assert.match(run.stdout, /1\. \*\*Survey\*\*: One survey covers the field\./);
    assert.match(run.stdout, /2\. A plain finding\./);
    // The second topic had no agent: the default one is used.
    assert.match(
      run.stdout,
      /# Literature watch: Graph neural networks\n\n- Agent: literature-scout/,
    );
    const files = (await readdir(digestDir)).sort();
    const date = new Date().toISOString().slice(0, 10);
    assert.deepEqual(files, [
      `${date}-graph-neural-networks.md`,
      `${date}-pattern-avoidance-in-permutations.md`,
    ]);
    const written = await readFile(join(digestDir, files[1]), 'utf8');
    assert.ok(run.stdout.includes(written));
    // Kept for the report: one digest exactly as the program prints it.
    if (process.env.WATCH_TEST_PRINT) console.log(written);
  } finally {
    server.close();
  }
});

test('a wrong key stops the run with exit code 2 and a clear message', async () => {
  const { server } = fakePlatform({ limitFirstPost: false });
  const url = await listen(server);
  try {
    const run = await runWatch({
      LUMEN_URL: url,
      LUMEN_API_KEY: 'lmn_wrong',
      WATCH_FILE: watchFile,
    });
    assert.equal(run.code, 2);
    assert.match(run.stderr, /401 bad key\. The API key is wrong or revoked\./);
    assert.equal(run.stdout, '');
  } finally {
    server.close();
  }
});

test('a failed session prints its digest and exits 1', async () => {
  const { server } = fakePlatform({ limitFirstPost: false, finalStatus: 'failed' });
  const url = await listen(server);
  try {
    const run = await runWatch({ LUMEN_URL: url, LUMEN_API_KEY: KEY, WATCH_FILE: watchFile });
    assert.equal(run.code, 1);
    assert.match(run.stdout, /- Status: failed/);
  } finally {
    server.close();
  }
});

test('a network error is retried three times, then the topic fails', async () => {
  // A server that is closed at once leaves a port with nothing behind it.
  const { server } = fakePlatform();
  const url = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  const run = await runWatch({ LUMEN_URL: url, LUMEN_API_KEY: KEY, WATCH_FILE: watchFile });
  assert.equal(run.code, 1);
  assert.equal((run.stderr.match(/network error, retry/g) ?? []).length, 6);
  assert.match(run.stdout, /- Error: POST \/api\/v1\/questions: /);
});

test('missing configuration exits 2', async () => {
  const run = await runWatch({ WATCH_FILE: watchFile });
  assert.equal(run.code, 2);
  assert.match(run.stderr, /Set LUMEN_URL/);
});
