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
  txt(s, 'An AI for research,\nbuilt as a platform', {
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
  'What Lumen is',
  'Lumen is an AI for research',
  'tree',
  'Lumen is an AI for research. You ask one question; a lead agent plans the work and three readers work on it in parallel. ' +
    'Every step is recorded with its cost, under a cap of one dollar per account. Three findings and one answer come back.',
);
shown(
  'Overview',
  'Platform thinking',
  'Producers, consumers, one platform',
  'platform',
  'Lumen is a platform. The seed is the engine every question needs: the tree of agents, the record of every step, and the cost cap. ' +
    'A producer publishes an agent. A consumer app gets an API key and asks with that agent. ' +
    'The scope is the six use cases of our proposal, all running on the public server; the literature watch app is about 210 lines, because the platform does the rest.',
);

// ------------------------------------------------------------------ project conduct
shown(
  'Conduct',
  'Milestones and effort',
  "We worked to the proposal's plan",
  'milestones',
  'This is the plan from our proposal: ten person-days for each member, from 8 to 21 October. ' +
    'Architecture and the service contracts first, then each service, then autoscaling, the public API and the pipeline. ' +
    'Every part is built and runs on AWS. [TEAM TO FILL: the actual effort of each member, from the report section 2.3.]',
);

// ------------------------------------------------------------------ logical architecture
shown(
  'Logical',
  'Domain-driven design',
  'How we found the contexts',
  'derive',
  'How we derived the bounded contexts. We took the words our users say in the six use cases, and grouped the words that belong together: ' +
    'a context ends where a word changes its meaning. Inside each context, the aggregate is what one transaction must keep consistent: ' +
    'a task tree rolls up its cost; a wallet never passes its cap without an approval. Each context became one service.',
);
shown(
  'Logical',
  'Domain-driven design',
  'Five contexts, joined by events',
  'contexts',
  'One question crosses the contexts as domain events: question asked, turn queued, step recorded, spend recorded, ' +
    "approval needed when a step would pass the cap, and finding recorded. The contexts talk through ports, never through each other's code.",
);
shown(
  'Logical',
  'Logical architecture',
  'Five services, one queue of work',
  'services',
  'Five services: identity, project, session, worker and billing; Traefik is the gateway. ' +
    'Key decision: a turn goes to a worker on a durable RabbitMQ queue, not on a direct call. A slow model call never holds a web request, ' +
    'any worker can take any turn, and the autoscaler can watch the queue. Every step is saved in PostgreSQL and streamed to the screen.',
);
shown(
  'Logical',
  'Key decision',
  'One queue for each level of the tree',
  'depth',
  'A lead waits for its readers, and a waiting lead keeps its worker. With one shared queue, two leads can take both workers, ' +
    'and their readers never start: a deadlock. So every worker has a slot for each level, fed by its own queue: lumen.turns.0, 1 and 2. ' +
    'The deepest level waits for nothing, so every question finishes.',
);

// ------------------------------------------------------------------ physical architecture
shown(
  'Physical',
  'Nodes and network',
  'One public server on AWS',
  'hosting',
  'k3s on one t3.medium in AWS Singapore, about 1.3 dollars a day. Only ports 22, 80 and 443 are open; the Kubernetes API is closed. ' +
    "Traefik is the gateway: it serves HTTPS with a Let's Encrypt certificate and routes each path to its service. " +
    'Services call each other on /internal with a secret header, and /internal has no route from outside. ' +
    'Key decisions: k3s rather than EKS, so the same Helm chart runs on a laptop and on AWS; and HPA on CPU for the web services, KEDA on queue length for the workers.',
);
shown(
  'Physical',
  'Persistence',
  'The schema, by context',
  'schema',
  'One PostgreSQL database; each context owns its tables, and the migration prefix shows the owner. ' +
    'An API key is stored only as its SHA-256 hash. A task points to its parent, so the tree and its cost roll-up are SQL. ' +
    'Money is numeric(12,6), and every total is a SUM in SQL. An approval is decided under SELECT FOR UPDATE, so a grant is used once. ' +
    'Turns in flight are in three durable RabbitMQ queues, and project files are on a volume.',
);
shown(
  'Physical',
  'Detailed design',
  'Asking a question with a chosen agent',
  'sequence',
  'The representative use case: the literature watch app asks a question with its API key and a chosen agent. ' +
    'The project service checks the key and its scope, writes the choice, and asks session to start. ' +
    "Session puts the first turn on lumen.turns.0. A worker takes it, puts the agent's instructions in front of the question, calls the model, " +
    'and reports each step back to session over /internal. The kernel did not change: its Worker port got a queue adapter. Then the app reads the answer.',
);

// ------------------------------------------------------------------ DevOps
shown(
  'DevOps',
  'Source and artifacts',
  'From a branch to a running image',
  'source',
  'One monorepo. Each member merges a branch into ass/platform. A push builds one image tagged with the commit SHA. ' +
    'The image goes to the server over SSH, k3s imports it, and helm upgrade replaces the pods.',
);
shown(
  'DevOps',
  'Pipeline',
  'Six checks around one deploy',
  'pipeline',
  'Every push runs the tests, npm audit, CodeQL, a Trivy scan of the image, the Helm deploy, an OWASP ZAP scan of the live server, and a small k6 load. ' +
    'The image scan is a gate: in the first run it found five critical issues and stopped the deploy, so a vulnerable image never reached the server. ' +
    'We built a smaller platform image, and the next run went live in 12.5 minutes.',
);
shown(
  'DevOps',
  'Recorded on GitHub',
  'The real runs',
  'rec-pipeline',
  'The real pipeline runs, from the GitHub command line: every job of one run, with its result.',
);

// ------------------------------------------------------------------ demo
shown(
  'Demo',
  'Scalability',
  'Load grows, workers follow',
  'scale',
  'From our load test. Ten users ask without pause; one worker falls behind and the queue grows. ' +
    'Above five waiting jobs per worker, KEDA adds one: one to four workers in 49 seconds. ' +
    '135 questions, median 6.1 seconds, none of the 1,040 requests failed. We run it live next.',
);
shown(
  'Demo',
  'Availability',
  'A worker dies; the question still ends',
  'kill',
  'A job leaves the queue only when its worker says done. We force-delete a worker mid-question; ' +
    'its jobs go back to the queue, a new worker takes them, and the question ends.',
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

// ------------------------------------------------------------------ backup: the recordings, if the network fails
shown(
  'Backup',
  'Recorded through the API',
  'A real question, a real answer',
  'rec-ask',
  'A real question through the public API, with an API key, answered by gpt-4.1-nano in under two seconds.',
);
shown(
  'Backup',
  'Recorded on the server',
  'KEDA adds workers',
  'rec-scale',
  'The real-model load test: the queue reached 10 jobs per worker against the target of five, so KEDA added a worker, and removed it after the load.',
);
shown(
  'Backup',
  'Recorded on the server',
  'Killed for real',
  'rec-kill',
  'A question starts, we force-delete the worker, and the question still ends.',
);
shown(
  'Backup',
  'Recorded on the server',
  'Every service is running',
  'rec-pods',
  'Five services, PostgreSQL and RabbitMQ, and the autoscalers, from kubectl on the server.',
);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(spec, null, 1));
pres
  .writeFile({ fileName: path.join(OUT, 'Team15-Lumen-Platform.pptx') })
  .then((f) => console.log(f, spec.length, 'slides'));
