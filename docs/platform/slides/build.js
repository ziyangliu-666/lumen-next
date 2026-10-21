// The ASS presentation deck (docs/platform/slides/README.md has the rules).
// lumen's dark look (theme.css): black page, white ink, grey secondary text, thin grey
// rules, zero radius, Switzer, no red. The order follows the course's presentation
// outline (reviews/2026-10-21-audience-clarity.md): overview, project conduct, logical
// architecture, physical architecture, DevOps, then the demo, where each animation is
// followed by the real recording of the same thing on the public server.
// Switzer must be installed where the deck is shown (see the README).
//
//   node docs/platform/slides/build.js
//
// It writes out/Team15-Lumen-Platform.pptx and out/slides.json, which preview.py draws.
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const PAPER = '000000',
  INK = 'FFFFFF',
  GRAY = '9A9DA3',
  SOFT = '7C8086',
  RULE = '45484C',
  WELL = '1A1B1E';
const SANS = 'Switzer',
  TITLE = 'Switzer Medium',
  BOLD = 'Switzer Semibold',
  MONO = 'JetBrains Mono';
const OUT = path.join(__dirname, 'out');
const URL = 'lumen.54-179-112-87.sslip.io';
const gif = (n) => path.join(OUT, n + '.gif');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inches
pres.author = 'Team 15';
pres.title = 'Lumen Platform';

const spec = [];
let cur = null;
const newSlide = (backdrop) => {
  const s = pres.addSlide();
  s.background = backdrop ? { path: path.join(OUT, backdrop) } : { color: PAPER };
  cur = { bg: PAPER, backdrop: backdrop ? path.join(OUT, backdrop) : null, items: [] };
  spec.push(cur);
  return s;
};
const txt = (s, text, o) => {
  const opts = { fontFace: SANS, isTextBox: true, margin: 0, valign: 'top', color: INK, ...o };
  s.addText(text, opts);
  cur.items.push({ kind: 'text', text, ...opts });
};
const rect = (s, x, y, w, h, fill, line) => {
  s.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w,
    h,
    fill: fill ? { color: fill } : { type: 'none' },
    line: line ? { color: line, width: 1 } : { type: 'none' },
  });
  cur.items.push({ kind: 'rect', x, y, w, h, fill, line });
};
const picture = (s, file, x, y, w, h) => {
  s.addImage({ path: file, x, y, w, h });
  cur.items.push({ kind: 'image', file, x, y, w, h });
};

// Where the talk is: thin segments at the foot of every slide, as at the foot of
// lumen's intro; the current part is white.
const PARTS = ['Overview', 'Conduct', 'Logical', 'Physical', 'DevOps', 'Demo'];
function progress(s, part) {
  const n = PARTS.indexOf(part);
  const pw = (12.13 - 0.15 * (PARTS.length - 1)) / PARTS.length;
  PARTS.forEach((p, i) => rect(s, 0.6 + i * (pw + 0.15), 7.1, pw, 0.03, i === n ? INK : RULE));
}
function head(s, part, kicker, title) {
  txt(s, `${part}  ·  ${kicker}`, { x: 0.6, y: 0.42, w: 12, h: 0.32, fontSize: 14, color: GRAY });
  txt(s, title, {
    x: 0.6,
    y: 0.78,
    w: 12.1,
    h: 0.8,
    fontSize: 34,
    fontFace: TITLE,
    valign: 'middle',
  });
  progress(s, part);
}
// One slide, one picture: an animation, or a recording of the real thing.
function shown(part, kicker, title, name, notes) {
  const s = newSlide();
  head(s, part, kicker, title);
  picture(s, gif(name), 0.6, 1.85, 12.13, 5.0);
  s.addNotes(notes);
}

// A table drawn with thin rules: a grey header row, then one rule above each row.
// cols: [{w, size, face, color}]; rows: arrays of strings, one per column.
function grid(s, x, y, cols, header, rows, rowH) {
  let cx = x;
  cols.forEach((c, i) => {
    txt(s, header[i], { x: cx, y, w: c.w - 0.2, h: 0.3, fontSize: 14, color: GRAY });
    cx += c.w;
  });
  const total = cols.reduce((a, c) => a + c.w, 0);
  rows.forEach((row, r) => {
    const ry = y + 0.42 + r * rowH;
    rect(s, x, ry, total, 0.01, RULE);
    let rx = x;
    row.forEach((cell, i) => {
      const c = cols[i];
      txt(s, cell, {
        x: rx,
        y: ry + 0.06,
        w: c.w - 0.2,
        h: rowH - 0.1,
        fontSize: c.size || 16,
        fontFace: c.face || SANS,
        color: c.color || INK,
        valign: 'middle',
      });
      rx += c.w;
    });
  });
}
// A slide of key decisions: what we chose, what we did not choose, and what it costs.
function decisions(part, title, rows, notes) {
  const s = newSlide();
  head(s, part, 'Key decisions', title);
  grid(
    s,
    0.6,
    1.85,
    [
      { w: 4.6, face: BOLD, size: 17 },
      { w: 3.5, color: GRAY },
      { w: 4.03, color: GRAY },
    ],
    ['we chose', 'instead of', 'what it costs'],
    rows,
    0.78,
  );
  s.addNotes(notes);
}

// ------------------------------------------------------------------ title
{
  const s = newSlide('title.png');
  txt(s, 'Architecting Scalable Systems  ·  Team 15', {
    x: 0.8,
    y: 1.9,
    w: 7,
    h: 0.4,
    fontSize: 18,
    color: GRAY,
  });
  txt(s, 'Lumen Platform', {
    x: 0.8,
    y: 2.4,
    w: 8,
    h: 1.3,
    fontSize: 64,
    fontFace: TITLE,
    valign: 'middle',
  });
  txt(s, 'A platform for teams of\nAI research agents', {
    x: 0.8,
    y: 3.75,
    w: 7,
    h: 1.1,
    fontSize: 26,
    color: GRAY,
  });
  txt(s, 'He Rong  ·  Li Zhuoyang  ·  Liu Ziyang  ·  Lu Yi  ·  Peng Xujian', {
    x: 0.8,
    y: 5.7,
    w: 8,
    h: 0.4,
    fontSize: 16,
  });
  txt(s, URL, { x: 0.8, y: 6.15, w: 8, h: 0.4, fontSize: 15, fontFace: MONO, color: GRAY });
  s.addNotes(
    'Good morning. We are Team 15. Lumen Platform is a platform on which teams of AI agents do research work. ' +
      'Everything we show runs on a public server; the address is on the slide. ' +
      'Every animation explains one part, and after it we show the real recording of the same thing.',
  );
}

// ------------------------------------------------------------------ overview
shown(
  'Overview',
  'The problem',
  'One chat window is not enough',
  'problem',
  'A researcher who uses an AI model today works in one chat window. It does one thing at a time, so five parts take five rounds. ' +
    'A long chat drops its first messages without warning. And nobody sees the cost until the bill. ' +
    'Lumen gives the question to a team of agents: a lead splits it, readers work at once, and the cost is shown live.',
);
shown(
  'Overview',
  'What Lumen does',
  'A team of agents for each question',
  'tree',
  'One question on our server. A lead agent plans and splits the work; three readers work in parallel. ' +
    'Every step is recorded with what it cost, against a cap of one dollar per account. ' +
    'Three findings and the answer come back, for three cents. This was a demo-mode run, without a model; we show a real-model answer in the demo.',
);

{
  const s = newSlide();
  head(s, 'Overview', 'Platform thinking', 'One engine; producers and consumers plug in');
  grid(
    s,
    0.6,
    1.95,
    [
      { w: 2.2, face: BOLD, size: 20 },
      { w: 3.4, color: GRAY, size: 18 },
      { w: 6.53, size: 18 },
    ],
    ['role', 'who', 'what they do'],
    [
      ['Seed', 'the run engine', 'runs a question as a tree of recorded, costed steps under a cap'],
      ['Producer', 'an agent author', 'publishes an agent, and reads how much it is used'],
      [
        'Consumer',
        'a research team, or an app',
        'asks with a chosen agent; reads the answer and the cost',
      ],
      ['Operator', 'our team', 'reads the usage of every account and agent'],
    ],
    1.0,
  );
  s.addNotes(
    'Platform thinking. The seed is the engine every question needs: the tree of agents, the record of every step, and the cost cap. ' +
      'Producers add agents. Consumers, the web app and any app with an API key, ask questions with them. ' +
      'Our team is the operator. A new app gets all of the seed for free; the literature watch is about 210 lines.',
  );
}
{
  const s = newSlide();
  head(s, 'Overview', 'Scope', 'What we built, and what we left out');
  txt(s, 'built and running on the public server', {
    x: 0.6,
    y: 1.85,
    w: 6,
    h: 0.3,
    fontSize: 14,
    color: GRAY,
  });
  const built = [
    ['UC1', 'Publish an agent'],
    ['UC2', 'Ask with a chosen agent; read the answer'],
    ['UC3', 'API keys, scopes, a rate limit'],
    ['UC4', 'Approve a step that passes the cap'],
    ['UC5', 'Usage per account and per agent'],
    ['UC6', 'Literature watch: a second app'],
  ];
  built.forEach(([id, t], i) => {
    const y = 2.25 + i * 0.66;
    rect(s, 0.6, y, 6.1, 0.01, RULE);
    txt(s, id, {
      x: 0.6,
      y: y + 0.08,
      w: 0.9,
      h: 0.5,
      fontSize: 16,
      fontFace: MONO,
      color: GRAY,
      valign: 'middle',
    });
    txt(s, t, { x: 1.5, y: y + 0.08, w: 5.2, h: 0.5, fontSize: 18, valign: 'middle' });
  });
  txt(s, 'left out', { x: 7.3, y: 1.85, w: 5, h: 0.3, fontSize: 14, color: GRAY });
  const out = [
    'Payments to producers',
    'More than one region',
    'One database per service',
    'EKS, with node autoscaling',
    'Agents as remote endpoints',
    'Tracing and metrics',
  ];
  out.forEach((t, i) => {
    const y = 2.25 + i * 0.66;
    rect(s, 7.3, y, 5.43, 0.01, RULE);
    txt(s, t, { x: 7.3, y: y + 0.08, w: 5.4, h: 0.5, fontSize: 18, color: GRAY, valign: 'middle' });
  });
  s.addNotes(
    'Scope. The six use cases of the proposal are built and run on the public server, with autoscaling, the pipeline and HTTPS. ' +
      'We left out payments and more regions, as the proposal said. We moved four things to the roadmap: a database per service, EKS, ' +
      'agents as remote endpoints from producers, and tracing. The report gives the reason for each.',
  );
}

// ------------------------------------------------------------------ project conduct
{
  const s = newSlide();
  head(s, 'Conduct', 'Team', 'Five people, one part each');
  const team = [
    ['Liu Ziyang', 'session service, the queue protocol, integration'],
    ['Li Zhuoyang', 'workers'],
    ['Lu Yi', 'sign-in, API keys, gateway, HTTPS'],
    ['Peng Xujian', 'projects, agent registry, literature watch app, load test'],
    ['He Rong', 'billing, Kubernetes, the pipeline'],
  ];
  txt(s, 'hours', { x: 11.4, y: 1.7, w: 1.3, h: 0.3, fontSize: 14, color: GRAY, align: 'right' });
  team.forEach(([who, what], i) => {
    const y = 2.1 + i * 0.92;
    rect(s, 0.6, y - 0.12, 12.13, 0.01, RULE);
    txt(s, who, { x: 0.6, y, w: 3.2, h: 0.6, fontSize: 22, fontFace: BOLD, valign: 'middle' });
    txt(s, what, { x: 3.9, y, w: 7.3, h: 0.6, fontSize: 20, color: GRAY, valign: 'middle' });
    txt(s, '—', {
      x: 11.4,
      y,
      w: 1.3,
      h: 0.6,
      fontSize: 20,
      color: SOFT,
      align: 'right',
      valign: 'middle',
    });
  });
  s.addNotes(
    'Each of us owns one part from design to deployment. ' +
      '[TEAM TO FILL: replace each dash with the hours that member spent, from the report section 2.3.]',
  );
}
{
  const s = newSlide();
  head(s, 'Conduct', 'Status', 'Where we are, and what is open');
  const done = [
    ['6 Oct', 'Proposal approved: scalable microservices'],
    ['20 Oct', 'Five services, Helm, KEDA, public HTTPS'],
    ['20 Oct', 'API keys, agent registry, literature watch app'],
    ['20 Oct', 'Pipeline: SCA, SAST, image scan, DAST, k6'],
    ['21 Oct', 'Real model on the server: gpt-4.1-nano'],
  ];
  done.forEach(([d, t], i) => {
    const y = 1.95 + i * 0.6;
    txt(s, d, { x: 0.6, y, w: 1.3, h: 0.5, fontSize: 18, color: GRAY, valign: 'middle' });
    txt(s, t, { x: 2.0, y, w: 5.2, h: 0.5, fontSize: 18, valign: 'middle' });
  });
  txt(s, 'open', { x: 7.75, y: 1.6, w: 4, h: 0.3, fontSize: 14, color: GRAY });
  const open = [
    ['One copy of the session service', 'live work moves to the database'],
    ['One database shared by all services', 'a database per service'],
    ["A killed worker's jobs run twice", 'jobs that are safe to repeat'],
  ];
  open.forEach(([limit, next], i) => {
    const y = 1.95 + i * 1.0;
    rect(s, 7.75, y, 4.98, 0.85, WELL);
    txt(s, limit, { x: 7.95, y: y + 0.08, w: 4.6, h: 0.38, fontSize: 17, fontFace: BOLD });
    txt(s, 'next: ' + next, { x: 7.95, y: y + 0.45, w: 4.6, h: 0.34, fontSize: 15, color: GRAY });
  });
  s.addNotes(
    'Status: everything you will see is built and runs on the public server. The milestones are from our git history. ' +
      'Three open issues, each with its next step; the report lists all thirteen, with owners.',
  );
}

// ------------------------------------------------------------------ logical architecture

decisions(
  'Logical',
  'Six choices shape the services',
  [
    [
      'Five services from the existing slices',
      'eight new services',
      'stream and model gateway stay inside',
    ],
    [
      'A turn goes to a worker on a durable queue',
      'a direct HTTP call',
      'one more part to run: RabbitMQ',
    ],
    ['A queue for each level of the tree', 'one queue', 'three queues to watch'],
    [
      'Only session writes the trace',
      'workers write to the database',
      'one HTTP call for each step',
    ],
    [
      'One shared database',
      'a database per service',
      'coupled at the schema; one point of failure',
    ],
    ['A versioned API with scoped keys', 'the web cookie for apps too', 'two ways to sign in'],
  ],
  'Six decisions shape the logical architecture; the report has them as AD-01 to AD-07. ' +
    'Services follow the slices we already had, so their tests stay. A turn goes on a durable queue, so a slow model call never holds a web request, ' +
    'any worker can take it, and KEDA can scale on the queue. A queue for each level prevents a deadlock; the next slides show it. ' +
    'Session is the only writer of the trace, so a worker that dies loses nothing. One shared database was a choice for time, and it is our first open issue.',
);
{
  const s = newSlide();
  head(s, 'Logical', 'Domain-driven design', 'How we found the contexts');
  txt(
    s,
    'list what users do   →   group the words they use   →   find what one transaction keeps consistent',
    {
      x: 0.6,
      y: 1.75,
      w: 12.1,
      h: 0.35,
      fontSize: 15,
      color: GRAY,
    },
  );
  grid(
    s,
    0.6,
    2.25,
    [
      { w: 3.6, size: 16 },
      { w: 3.4, color: GRAY, size: 16 },
      { w: 2.1, face: BOLD, size: 18 },
      { w: 3.03, size: 16 },
    ],
    ['what users do', 'the words they use', 'context', 'aggregate'],
    [
      ['sign up, make API keys', 'account, key, scope', 'Identity', 'Account, ApiKey'],
      ['publish an agent, ask a question', 'agent, project, finding', 'Projects', 'Agent, Project'],
      ['watch the run, steer it', 'session, task, step', 'Session', 'Session and its task tree'],
      ['run the agents', 'reader, tool, sandbox', 'Execution', 'none: it keeps no state'],
      ['set a cap, approve a step', 'cap, spend, ledger, approval', 'Billing', 'Wallet, Approval'],
    ],
    0.8,
  );
  s.addNotes(
    'How we derived the contexts. First we listed what the users do, from the use cases. Then we grouped the words they use: ' +
      'a context ends where a word changes its meaning. "Cost" is a number on a step in Session, and a ledger entry in Billing. ' +
      'Then, inside each context, the aggregate is what one transaction must keep consistent: a task tree rolls up its cost; ' +
      'a wallet never passes its cap without an approval. The check: each context was already one module of our monolith, and it became one service.',
  );
}
shown(
  'Logical',
  'Domain-driven design',
  'Five bounded contexts, joined by events',
  'contexts',
  'Domain-driven design gives us five bounded contexts: Identity, Projects, Session, Execution and Billing. ' +
    'Grey lines inside each box are its aggregates. One question crosses them as domain events: question asked, turn queued, ' +
    'step recorded, spend recorded, approval needed when a step would pass the cap, and finding recorded.',
);
shown(
  'Logical',
  'Platform',
  'Producers, consumers, one platform',
  'platform',
  'Lumen is a platform. A producer publishes an agent: instructions for one kind of question. ' +
    'A consumer app gets an API key and picks an agent. The platform runs it, records every step and bills it. ' +
    'So the literature watch app is about 210 lines: no database, no model, no billing of its own.',
);
shown(
  'Logical',
  'Services',
  'Five services, one queue of work',
  'services',
  'Five services: identity, project, session, worker and billing; Traefik is the gateway. ' +
    'Follow one question: project opens a session, session puts the work in a RabbitMQ queue, and a worker takes it. ' +
    'Every step is saved in PostgreSQL and shown on the screen. More waiting work means more workers.',
);
shown(
  'Logical',
  'A design decision',
  'One queue for each level of the tree',
  'depth',
  'One decision that matters. A lead waits for its readers, and a waiting lead keeps its worker. ' +
    'With one shared queue, two leads can take both workers, and their readers never start: a deadlock. ' +
    'So every worker has a slot for each level, fed by its own queue; in the code there are three, lumen.turns.0, 1 and 2. ' +
    'The deepest level waits for nothing, so every question finishes.',
);
shown(
  'Logical',
  'Platform API',
  'What an API key may do',
  'keys',
  'Apps get a key, not a password. It carries scopes and is stored only as a hash. ' +
    "Inside its scopes it works; on the web app's own pages the gateway refuses it with 403; " +
    'past 20 requests at once or 60 a minute it gets 429.',
);

// ------------------------------------------------------------------ physical architecture

decisions(
  'Physical',
  'Six choices shape the deployment',
  [
    ['k3s on one EC2 t3.medium', 'EKS', 'one failure domain; no node scaling'],
    ['Traefik Ingress as the gateway', 'a gateway service', 'auth is checked in every service'],
    ['HPA on CPU; KEDA on queue length', 'CPU for every service', 'session does not scale'],
    ['No image registry: copy over SSH', 'GHCR or ECR', 'slower; one node only'],
    ['Secrets made inside the cluster', 'secrets kept in GitHub', 'a lost cluster loses them'],
    ["sslip.io and Let's Encrypt", 'a bought domain', 'the name changes with the IP'],
  ],
  'Six decisions shape the physical architecture, AD-09 to AD-14 in the report. ' +
    'One k3s node costs about 1.3 dollars a day, and the same Helm chart runs on our laptops and could run on EKS. ' +
    'Traefik is already in k3s, so the gateway is configuration, not a service. ' +
    'Agent load shows in the queues before it shows in CPU, because a worker waits on the model, so the workers scale on queue length. ' +
    'The database and broker passwords are made in the cluster and never leave it.',
);
shown(
  'Physical',
  'Hosting and network',
  'One public server on AWS',
  'hosting',
  'One t3.medium in AWS Singapore, about 1.3 dollars a day. Only ports 22, 80 and 443 are open; the Kubernetes API is closed. ' +
    "Traefik serves HTTPS with a Let's Encrypt certificate and routes each path to its service. " +
    'Services call each other on /internal with a secret header, and /internal has no route from outside. ' +
    'A push deploys over SSH and the pods are replaced one by one.',
);
shown(
  'Physical',
  'Persistence',
  'What is stored where',
  'persistence',
  'One PostgreSQL database; each context keeps its own tables. API keys are stored only as hashes. ' +
    'RabbitMQ keeps three durable queues, and project files go on a volume. ' +
    'A turn stays in its queue until a worker acknowledges it. Today one database for all; next, one per service.',
);
{
  const s = newSlide();
  head(s, 'Physical', 'Schema', 'The main tables, by context');
  const ctx = [
    [
      'Identity',
      2.75,
      [
        ['accounts', 'id, email, role'],
        ['platform_api_keys', 'prefix, key_hash,\nscopes, revoked_at'],
        ['credentials', 'account_id, hash'],
        ['auth_sessions', 'account_id, token'],
      ],
    ],
    [
      'Projects',
      3.35,
      [
        ['projects', 'account_id, title, mode'],
        ['findings', 'session_id, title, text'],
        ['platform_agents', 'slug, instructions,\nwithdrawn_at'],
        ['platform_question_intents', 'agent_id, session_id'],
      ],
    ],
    [
      'Session',
      2.85,
      [
        ['sessions', 'project_id, account_id'],
        ['tasks', 'parent_id, depth,\nstatus, own_cost'],
        ['steps', 'task_id, kind, text'],
      ],
    ],
    [
      'Billing',
      2.85,
      [
        ['billing_wallets', 'account_id, cap'],
        ['ledger_entries', 'task_id, amount'],
        ['billing_approvals', 'attempt_id, status,\nresume_pending'],
      ],
    ],
  ];
  let x = 0.6;
  ctx.forEach(([name, w, tables]) => {
    const bw = w - 0.11;
    rect(s, x, 1.85, bw, 4.4, null, RULE);
    txt(s, name, { x: x + 0.15, y: 1.95, w: bw - 0.3, h: 0.4, fontSize: 18, fontFace: BOLD });
    tables.forEach(([t, cols], i) => {
      const y = 2.45 + i * 0.94;
      txt(s, t, { x: x + 0.15, y, w: bw - 0.2, h: 0.3, fontSize: 14, fontFace: MONO });
      txt(s, cols, { x: x + 0.15, y: y + 0.29, w: bw - 0.2, h: 0.56, fontSize: 14, color: GRAY });
    });
    x += w + 0.11;
  });
  const rules = [
    ['money', 'numeric(12,6); every total is a SUM in SQL'],
    ['approvals', 'decided under FOR UPDATE: a grant is used once'],
    ['outbox', 'SKIP LOCKED, with a 30 s lease'],
  ];
  rules.forEach(([k, v], i) => {
    const x = 0.6 + i * 4.1;
    txt(s, k, { x, y: 6.4, w: 1.1, h: 0.5, fontSize: 14, color: GRAY });
    txt(s, v, { x: x + 1.1, y: 6.4, w: 2.9, h: 0.5, fontSize: 14 });
  });
  s.addNotes(
    'The schema. One PostgreSQL database, and each context owns its tables; the migration prefix shows the owner. ' +
      'A task has a parent and a depth, so the tree and its cost roll-up are SQL. Money is numeric, never a JavaScript number. ' +
      'An approval is decided in one transaction with SELECT FOR UPDATE. The approved row is an outbox: billing pods claim rows with SKIP LOCKED, ' +
      'so two pods never resume the same task. The API key itself is never stored, only its SHA-256 hash.',
  );
}
shown(
  'Physical',
  'One use case in detail',
  'Asking a question with a chosen agent',
  'sequence',
  'The detailed use case: the literature watch app asks a question with its API key and a chosen agent. ' +
    'Project creates the project and asks session to start; session puts the first turn on lumen.turns.0; ' +
    "a worker takes it, applies the agent's instructions, calls gpt-4.1-nano and reports each step; then the app reads the answer.",
);
{
  const s = newSlide();
  head(s, 'Physical', 'One use case in detail', 'Three ports, with new adapters');
  grid(
    s,
    0.6,
    1.85,
    [{ w: 3.0, face: MONO, size: 16 }, { w: 3.3, color: GRAY }, { w: 5.83 }],
    ['the kernel calls', 'in the monolith', 'in the platform'],
    [
      ['Worker', 'the agent loop, in-process', 'QueueWorker: puts the turn on lumen.turns.<level>'],
      ['WorkerReport', 'the kernel itself', 'RemoteReport: POST /internal/turns/:id/<step>'],
      ['SessionDirectory', 'the kernel itself', 'remote: POST /internal/directory/start'],
    ],
    0.72,
  );
  txt(s, 'when it fails', { x: 0.6, y: 4.55, w: 4, h: 0.3, fontSize: 14, color: GRAY });
  const fails = [
    ['a worker dies before it acks', 'RabbitMQ gives the turn to another worker'],
    ['/done gets 404', 'the worker acks and drops the turn, so it never loops'],
    ['an app passes its rate', '429 with Retry-After; the app waits and asks again'],
  ];
  fails.forEach(([a, b], i) => {
    const y = 4.95 + i * 0.6;
    rect(s, 0.6, y, 12.13, 0.01, RULE);
    txt(s, a, { x: 0.6, y: y + 0.06, w: 4.6, h: 0.48, fontSize: 16, valign: 'middle' });
    txt(s, b, {
      x: 5.2,
      y: y + 0.06,
      w: 7.5,
      h: 0.48,
      fontSize: 16,
      color: GRAY,
      valign: 'middle',
    });
  });
  s.addNotes(
    'The detailed design of the same use case. The kernel, the code that runs a session, did not change. It calls three ports. ' +
      'In the monolith they are in-process. In the platform, Worker becomes QueueWorker, which publishes the turn on the queue for its level; ' +
      'WorkerReport becomes RemoteReport, so each step a worker makes is a POST to session; and the project service reaches the kernel through a remote session directory. ' +
      'The key guard, the agent lookup and the intent row are in the report, section 3.2.4, with a second use case: a step over the cap that waits for approval.',
  );
}
shown(
  'Physical',
  'Recorded on the server',
  'Every service is running',
  'rec-pods',
  'This is a recording of the real server. kubectl runs on the server through SSH, because the Kubernetes API is not public. ' +
    'Five services, PostgreSQL and RabbitMQ, and the autoscalers: CPU for identity, project and billing, and KEDA for the workers, on the queue length.',
);

// ------------------------------------------------------------------ DevOps
shown(
  'DevOps',
  'Source and artifacts',
  'From a branch to a running image',
  'source',
  'One monorepo. main is the monolith we built for another course; ass/platform is this platform, and each member merges a branch into it. ' +
    'A push builds one image tagged with the commit SHA. There is no registry: the image goes to the server over SSH, ' +
    'and helm upgrade replaces the pods.',
);
shown(
  'DevOps',
  'Pipeline',
  'Six checks around one deploy',
  'pipeline',
  'Every push runs tests, npm audit, CodeQL, a Trivy scan of the image, the deploy with Helm, an OWASP ZAP scan of the live server, ' +
    'and a small k6 load. Run 39439752963 stopped at the image scan: five critical issues. ' +
    'We built a platform image without Docker, patched at build, and run 39441445313 passed every stage in about 12.5 minutes.',
);
{
  const s = newSlide();
  head(s, 'DevOps', 'Pipeline in detail', 'Every push to ass/platform');
  txt(s, 'run 39441445313  ·  12 min 30 s', {
    x: 7.7,
    y: 0.42,
    w: 5.03,
    h: 0.32,
    fontSize: 14,
    fontFace: MONO,
    color: GRAY,
    align: 'right',
  });
  const box = (x, y, w, h, name, time, lines) => {
    rect(s, x, y, w, h, null, RULE);
    txt(s, name, { x: x + 0.12, y: y + 0.08, w: w - 0.9, h: 0.32, fontSize: 15, fontFace: BOLD });
    if (time)
      txt(s, time, {
        x: x + w - 0.85,
        y: y + 0.08,
        w: 0.73,
        h: 0.32,
        fontSize: 14,
        fontFace: MONO,
        color: GRAY,
        align: 'right',
      });
    (lines || []).forEach((l, i) => {
      txt(s, l[0], {
        x: x + 0.12,
        y: y + 0.45 + i * 0.36,
        w: w - 0.9,
        h: 0.32,
        fontSize: 14,
        color: GRAY,
      });
      txt(s, l[1], {
        x: x + w - 0.85,
        y: y + 0.45 + i * 0.36,
        w: 0.73,
        h: 0.32,
        fontSize: 14,
        fontFace: MONO,
        color: GRAY,
        align: 'right',
      });
    });
  };
  const arrow = (x, y) =>
    txt(s, '→', {
      x,
      y,
      w: 0.3,
      h: 0.4,
      fontSize: 20,
      color: GRAY,
      align: 'center',
      valign: 'middle',
    });
  box(0.6, 2.75, 1.7, 0.75, 'push', null);
  txt(s, 'or a manual run', { x: 0.72, y: 3.15, w: 1.5, h: 0.3, fontSize: 14, color: GRAY });
  arrow(2.32, 2.92);
  box(2.65, 1.9, 2.55, 0.5, 'tests, lint', '5:05');
  box(2.65, 2.9, 2.55, 0.5, 'SCA npm audit', '0:33');
  box(2.65, 3.9, 2.55, 0.5, 'SAST CodeQL', '2:54');
  arrow(5.22, 2.92);
  box(5.55, 1.9, 3.3, 2.5, 'deploy', '5:30', [
    ['build the image', '2:50'],
    ['Trivy gate', '0:25'],
    ['copy, k3s import', '1:04'],
    ['helm upgrade --wait', '0:22'],
    ['poll /api/health', ''],
  ]);
  arrow(8.87, 2.92);
  box(9.2, 1.9, 2.1, 0.5, 'DAST ZAP', '1:40');
  box(9.2, 2.9, 2.1, 0.5, 'k6 smoke', '1:15');
  arrow(11.32, 2.92);
  box(11.65, 2.9, 1.08, 0.5, 'summary', null);
  const facts = [
    ['gate', 'a critical CVE with a fix stops the deploy before the image leaves GitHub'],
    [
      'environments',
      'local k3d on a laptop; the public k3s server. The pull request review is the gate',
    ],
    ['secrets', 'GitHub keeps only the SSH key and the model key; the model key goes on SSH stdin'],
    ['rollback', 'helm rollback on the server, or push a revert'],
  ];
  facts.forEach(([k, v], i) => {
    const y = 4.75 + i * 0.52;
    rect(s, 0.6, y, 12.13, 0.01, RULE);
    txt(s, k, {
      x: 0.6,
      y: y + 0.05,
      w: 2.0,
      h: 0.42,
      fontSize: 15,
      color: GRAY,
      valign: 'middle',
    });
    txt(s, v, { x: 2.6, y: y + 0.05, w: 10.1, h: 0.42, fontSize: 16, valign: 'middle' });
  });
  s.addNotes(
    'The pipeline in detail, with the times of run 39441445313. A push to ass/platform, or a manual run, starts three checks at once: ' +
      'the tests with lint and typecheck, npm audit on the production dependencies, and CodeQL. Only when all three pass does deploy start. ' +
      'It builds one image tagged with the commit, and Trivy fails the job on a critical CVE that has a fix, so the image never reaches the server. ' +
      'Then the image goes over SSH, k3s imports it, and helm upgrade waits for every readiness probe. ' +
      'After the deploy, OWASP ZAP scans the live address and k6 runs a small load, only in demo mode so a push never pays for model calls.',
  );
}
shown(
  'DevOps',
  'Recorded on GitHub',
  'The real runs',
  'rec-pipeline',
  'The real pipeline runs, from the GitHub command line: the list of runs, and every job of one run with its result.',
);
shown(
  'DevOps',
  'Recorded on the server',
  'Every deploy is a release',
  'rec-deploy',
  'Each deploy is a Helm release on the server, so we can see the history and roll back. The worker deployment has one revision per deploy.',
);

{
  const s = newSlide();
  head(s, 'DevOps', 'Technical findings', 'What broke, and what we did');
  grid(
    s,
    0.6,
    1.85,
    [{ w: 6.3 }, { w: 5.83, color: GRAY }],
    ['we found', 'we did'],
    [
      ['One shared queue can deadlock the workers', 'a queue for each level, found in design'],
      ['The image scan found 5 critical CVEs', 'a platform image without Docker, patched at build'],
      ['The agent choice can reach the worker late', 'write it first; the worker claims it'],
      ['KEDA waits 5 minutes to scale down', '60 seconds in the chart'],
      ['KEDA could not find RabbitMQ', 'the full name, rabbitmq.<ns>.svc.cluster.local'],
      ["A killed worker's jobs run twice", 'open: make jobs safe to repeat'],
    ],
    0.78,
  );
  s.addNotes(
    'What we found while we built it. The deadlock we found in design, before it happened. ' +
      'The image scan stopped run 39439752963: the monolith image carries Docker for its sandbox, and the platform workers never start a sandbox, so we built a smaller image. ' +
      'The first turn can reach a worker before the project request returns, so the agent choice is written first and claimed by the worker. ' +
      'Two KEDA settings: the default five-minute scale-down, and a short service name that does not work from the KEDA namespace. ' +
      'The last one is still open, and we show it in the demo.',
  );
}

// ------------------------------------------------------------------ demo
shown(
  'Demo',
  'Recorded through the API',
  'A real question, a real answer',
  'rec-ask',
  'A real question through the public API, with an API key, answered by gpt-4.1-nano. It was recorded on 21 October. It ended in under two seconds and cost USD 0.000168.',
);
shown(
  'Demo',
  'Scalability',
  'Load grows, workers follow',
  'scale',
  'How the scaling works, from our load test on 20 October. Ten users ask without pause; one worker falls behind and the queue grows. ' +
    'Above five waiting jobs per worker, KEDA adds one: one to four workers in 49 seconds. ' +
    '135 questions, median 6.1 seconds, none of the 1,040 requests failed.',
);
shown(
  'Demo',
  'Performance, recorded',
  'The k6 load test',
  'rec-load',
  'The k6 load test with the real model, recorded live and played faster. Ten virtual users ask without pause. 131 questions and 1,159 requests, none failed; the median question finished in 4.1 seconds, p95 in 27 seconds.',
);
shown(
  'Demo',
  'Scalability, recorded',
  'KEDA adds workers',
  'rec-scale',
  'The same run, recorded at the same time. The queue reached 10 jobs per worker against the target of five, so KEDA added a second worker, and removed it after the load. This run needed two workers; the demo-mode run on 20 October needed four.',
);
shown(
  'Demo',
  'Availability',
  'A worker dies; the question still ends',
  'kill',
  'What if a worker dies mid-question? A job leaves the queue only when its worker says done. ' +
    'We force-deleted a worker; its three jobs went back to the queue, a new worker took them, and the question ended in 12.6 seconds. ' +
    'The price: the jobs ran twice, 8 cents instead of 3. Making jobs safe to repeat is our next step.',
);
shown(
  'Demo',
  'Availability, recorded',
  'Killed for real',
  'rec-kill',
  'The same test on the public server, with the real model: a question starts, we force-delete the worker, and the question still ends. Its cost rose from USD 0.000255 to 0.000467, because the jobs ran twice.',
);
{
  const s = newSlide();
  head(s, 'Demo', 'Live', 'Now, on the public server');
  rect(s, 0.6, 1.9, 12.13, 0.95, null, RULE);
  txt(s, 'https://' + URL, {
    x: 0.6,
    y: 1.9,
    w: 12.13,
    h: 0.95,
    fontSize: 28,
    fontFace: MONO,
    align: 'center',
    valign: 'middle',
  });
  const steps = [
    'Ask a question in the browser',
    'Watch the tree grow, with its cost',
    'Run the load test; watch the workers',
    'The literature watch app asks through the API',
    'Open the last pipeline run on GitHub',
  ];
  steps.forEach((t, i) => {
    const y = 3.2 + i * 0.72;
    txt(s, String(i + 1), {
      x: 0.6,
      y,
      w: 0.6,
      h: 0.56,
      fontSize: 22,
      fontFace: TITLE,
      color: GRAY,
      valign: 'middle',
    });
    txt(s, t, { x: 1.3, y, w: 11, h: 0.56, fontSize: 24, valign: 'middle' });
  });
  s.addNotes(
    'Live demo, about eight minutes, with deploy/k8s/demo.sh and LUMEN_URL set to the address on the slide. ' +
      'Before the load test, switch the workers to demo mode (gh workflow run platform-deploy.yml -f worker=demo), so the load costs nothing; switch back afterwards. ' +
      'If the network fails, the recordings on the previous slides show the same runs.',
  );
}
{
  const s = newSlide('title.png');
  txt(s, 'Thank you', {
    x: 0.8,
    y: 2.4,
    w: 8,
    h: 1.3,
    fontSize: 64,
    fontFace: TITLE,
    valign: 'middle',
  });
  txt(s, 'Questions?', { x: 0.8, y: 3.8, w: 8, h: 0.6, fontSize: 28, color: GRAY });
  txt(s, 'https://' + URL, {
    x: 0.8,
    y: 4.7,
    w: 8,
    h: 0.5,
    fontSize: 18,
    fontFace: MONO,
    color: GRAY,
  });
  s.addNotes('Thank you. We are happy to take questions.');
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(spec, null, 1));
pres
  .writeFile({ fileName: path.join(OUT, 'Team15-Lumen-Platform.pptx') })
  .then((f) => console.log(f, spec.length, 'slides'));
