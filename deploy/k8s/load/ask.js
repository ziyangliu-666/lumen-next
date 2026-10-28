// k6 load test: many users ask questions at once, so the turn queues grow and
// KEDA scales the worker. Run it against workers in demo mode
// (config.worker=demo), which call no model, so the test costs no money.
//
//   k6 run -e LUMEN_URL=https://lumen.1-2-3-4.sslip.io deploy/k8s/load/ask.js
//
// Environment:
//   LUMEN_URL  the public origin, no trailing slash (required)
//   PROFILE    "full" (default: 1 -> 30 VUs over 2 min, hold 3 min, down 1 min)
//              or "short" (1 -> 10 VUs over 30 s, hold 1 min, down 20 s, for demo.sh)
//              or "smoke" (2 VUs for 30 s, for the deploy pipeline; use a small POOL)
//   POOL       accounts created in setup() (default 60)
//   SUMMARY    file for the JSON summary (default summary.json)
//
// The API calls come from the source:
//   POST /api/auth/signup   {email, displayName, password}  modules/identity/routes.ts
//   POST /api/auth/password {email, password}               modules/identity/routes.ts
//   POST /api/projects      {question, mode}                modules/projects/routes.ts, validation.ts
//   GET  /api/sessions/:id  -> SessionSnapshot              modules/session/routes.ts,
//                                                           packages/contracts/src/sessions.ts
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = (__ENV.LUMEN_URL || '').replace(/\/+$/, '');
if (!BASE) throw new Error('Set LUMEN_URL, for example -e LUMEN_URL=http://lumen.localhost');

// The identity slice sets this cookie (modules/identity/sessionStrategy.ts).
const AUTH_COOKIE = 'lumen_session';

// Each demo question costs USD 0.03 and every account has a USD 1 cap, so one
// account holds about 33 questions. The full profile asks several hundred, so
// the pool must be larger than the VU count; 60 accounts hold about 2000.
const POOL = Number(__ENV.POOL || 60);

// A root task in one of these states does no more work without the user.
// 'waiting' is an approval over the cap: counted apart, because it means the
// pool was too small, not that the platform was slow.
const AT_REST = ['ended', 'stopped', 'failed', 'waiting'];

// A demo question takes seconds; a turn stuck for this long is a failure.
const REST_TIMEOUT_S = 300;

const PROFILES = {
  full: [
    { duration: '2m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  short: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '20s', target: 0 },
  ],
  // A check that the deployed platform answers under a little load, not a
  // scaling test: the thresholds below still apply.
  smoke: [{ duration: '30s', target: 2 }],
};
const profile = __ENV.PROFILE || 'full';
if (!PROFILES[profile]) throw new Error(`PROFILE must be full, short or smoke, got "${profile}"`);

export const options = {
  scenarios: {
    ask: {
      executor: 'ramping-vus',
      // The smoke profile holds 2 VUs from the start instead of ramping up.
      startVUs: profile === 'smoke' ? 2 : 1,
      stages: PROFILES[profile],
    },
  },
  // Sign-up hashes passwords and the login gate admits 4 at a time.
  setupTimeout: '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

const timeToRest = new Trend('time_to_rest', true);
const questions = new Counter('questions');
const atRestStatus = new Counter('root_at_rest');
const overCap = new Counter('root_waiting');
const timedOut = new Counter('root_timed_out');

// The identity slice refuses a write whose Origin is not LUMEN_ORIGIN.
const JSON_HEADERS = { 'content-type': 'application/json', origin: BASE };

function randomHex(bytes) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieOf(res) {
  const jar = res.cookies[AUTH_COOKIE];
  return jar && jar.length > 0 ? jar[0].value : null;
}

function signIn(account) {
  const res = http.post(
    `${BASE}/api/auth/password`,
    JSON.stringify({ email: account.email, password: account.password }),
    { headers: JSON_HEADERS, tags: { name: 'POST /api/auth/password' } },
  );
  check(res, { 'sign-in 200': (r) => r.status === 200 });
  return cookieOf(res);
}

export function setup() {
  const run = `${Date.now().toString(36)}${randomHex(3)}`;
  // One password for the run: random, never printed, gone when the run ends.
  const password = `Load-${randomHex(16)}`;
  const accounts = [];
  for (let n = 0; n < POOL; n += 1) {
    const email = `load-${n}-${run}@example.com`;
    const res = http.post(
      `${BASE}/api/auth/signup`,
      JSON.stringify({ email, displayName: `Load ${n}`, password }),
      { headers: JSON_HEADERS, tags: { name: 'POST /api/auth/signup' } },
    );
    if (res.status !== 201) fail(`sign-up ${n} answered ${res.status}: ${res.body}`);
    accounts.push({ email, password, cookie: cookieOf(res) });
  }
  return { accounts };
}

// Per VU: the cookie it holds now, refreshed after a 401.
let cookie = null;

function authed(name) {
  return { cookies: { [AUTH_COOKIE]: cookie }, headers: JSON_HEADERS, tags: { name } };
}

export default function (data) {
  // VUs take accounts round-robin, so each account gets a share of the questions.
  const account = data.accounts[(__VU - 1) % data.accounts.length];
  if (!cookie) cookie = account.cookie || signIn(account);

  // Creating a project opens its first session (projects/projectService.ts).
  const question = `Load test ${__VU}-${__ITER}: how many permutations of 5 avoid 132?`;
  let res = http.post(
    `${BASE}/api/projects`,
    JSON.stringify({ question, mode: 'explore' }),
    authed('POST /api/projects'),
  );
  if (res.status === 401) {
    cookie = signIn(account);
    res = http.post(
      `${BASE}/api/projects`,
      JSON.stringify({ question, mode: 'explore' }),
      authed('POST /api/projects'),
    );
  }
  if (!check(res, { 'project 201': (r) => r.status === 201 })) {
    sleep(1);
    return;
  }
  questions.add(1);
  const sessionId = res.json('sessionId');
  const started = Date.now();

  while ((Date.now() - started) / 1000 < REST_TIMEOUT_S) {
    sleep(1);
    const snap = http.get(`${BASE}/api/sessions/${sessionId}`, authed('GET /api/sessions/:id'));
    if (snap.status !== 200) continue;
    const root = (snap.json('tasks') || []).find((task) => task.parentId === null);
    if (root && AT_REST.includes(root.status)) {
      timeToRest.add(Date.now() - started);
      atRestStatus.add(1, { status: root.status });
      if (root.status === 'waiting') overCap.add(1);
      return;
    }
  }
  timedOut.add(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const rest = m.time_to_rest ? m.time_to_rest.values : {};
  const seconds = (ms) => (ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);
  const count = (metric) => (m[metric] ? m[metric].values.count : 0);
  const failed = m.http_req_failed ? (m.http_req_failed.values.rate * 100).toFixed(2) : 'n/a';
  const lines = [
    `profile ${profile}, target ${BASE}`,
    `questions ${count('questions')}, at rest ${count('root_at_rest')}, ` +
      `waiting over cap ${count('root_waiting')}, timed out ${count('root_timed_out')}`,
    `time_to_rest median ${seconds(rest.med)}, p95 ${seconds(rest['p(95)'])}, max ${seconds(rest.max)}`,
    `http requests ${count('http_reqs')}, failed ${failed} %`,
    '',
  ];
  return {
    stdout: lines.join('\n'),
    [__ENV.SUMMARY || 'summary.json']: JSON.stringify(data, null, 2),
  };
}
