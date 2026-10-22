// The ASS presentation deck (docs/platform/slides/README.md has the rules).
// Redesigned on 21 October 2026: one slide answers one item of the course's presentation
// outline, and the item's number stands at its top left so the lecturer can tick it off.
// The pictures use standard notation (UML, ER, a context map, a flowchart) with real names
// in words; only flows are animated. Slide 2 is a real run of lumen.
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
  RULE = '45484C';
const SANS = 'Switzer',
  TITLE = 'Switzer Medium',
  MONO = 'JetBrains Mono';
const OUT = path.join(__dirname, 'out');
const URL = 'lumen.54-179-112-87.sslip.io';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inches
pres.author = 'Team 15';
pres.title = 'Lumen Platform';

const spec = [];
let cur = null;
const newSlide = () => {
  const s = pres.addSlide();
  s.background = { color: PAPER };
  cur = { bg: PAPER, backdrop: null, items: [] };
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

// Where the talk is: thin segments at the foot of every slide; the current part is white.
const PARTS = ['Overview', 'Conduct', 'Logical', 'Physical', 'DevOps', 'Demo'];
function progress(s, part) {
  const n = PARTS.indexOf(part);
  const pw = (12.13 - 0.15 * (PARTS.length - 1)) / PARTS.length;
  PARTS.forEach((p, i) => rect(s, 0.6 + i * (pw + 0.15), 7.1, pw, 0.03, i === n ? INK : RULE));
}
function head(s, part, item, title) {
  txt(s, item, { x: 0.6, y: 0.42, w: 12, h: 0.32, fontSize: 14, color: GRAY });
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
// One slide, one picture. A picture that is not drawn yet shows as an empty frame.
function shown(part, item, title, file, notes) {
  const s = newSlide();
  head(s, part, item, title);
  const f = path.join(OUT, file);
  if (fs.existsSync(f)) {
    s.addImage({ path: f, x: 0.6, y: 1.85, w: 12.13, h: 5.0 });
    cur.items.push({ kind: 'image', file: f, x: 0.6, y: 1.85, w: 12.13, h: 5.0 });
  } else {
    rect(s, 0.6, 1.85, 12.13, 5.0, null, RULE);
    txt(s, file + ': not drawn yet', {
      x: 0.6,
      y: 4.1,
      w: 12.13,
      h: 0.5,
      fontSize: 18,
      color: GRAY,
      align: 'center',
    });
  }
  s.addNotes(notes);
}

// ------------------------------------------------------------------ title
{
  const s = newSlide();
  txt(s, 'Architecting Scalable Systems  ·  Team 15', {
    x: 0.8,
    y: 2.0,
    w: 11,
    h: 0.4,
    fontSize: 18,
    color: GRAY,
  });
  txt(s, 'Lumen Platform', {
    x: 0.8,
    y: 2.5,
    w: 11,
    h: 1.3,
    fontSize: 64,
    fontFace: TITLE,
    valign: 'middle',
  });
  txt(s, 'An AI that does research, built as a scalable platform', {
    x: 0.8,
    y: 3.85,
    w: 11,
    h: 0.6,
    fontSize: 26,
    color: GRAY,
  });
  txt(s, 'He Rong  ·  Li Zhuoyang  ·  Liu Ziyang  ·  Lu Yi  ·  Peng Xujian', {
    x: 0.8,
    y: 5.7,
    w: 11,
    h: 0.4,
    fontSize: 16,
  });
  txt(s, URL, { x: 0.8, y: 6.15, w: 11, h: 0.4, fontSize: 15, fontFace: MONO, color: GRAY });
  s.addNotes(
    'Good morning. We are Team 15. We present Lumen Platform, following the order of the presentation outline.',
  );
}

// ------------------------------------------------------------------ 1 overview
shown(
  'Overview',
  '1a  ·  Context and business problem',
  'Lumen is an AI that does research',
  'lumen-at-work.gif',
  'Lumen is an AI that does research. This is a real run, recorded on 22 October with gpt-4.1: we ask for three key papers on retrieval-augmented generation. ' +
    'The lead agent searches arXiv, then hands one paper each to three reader agents that work in parallel. ' +
    'On the right, the call tree grows, every task shows what it cost, and each reader records its paper as a finding. ' +
    'The business problem: every research team that uses agents builds the same parts again, a record of each step, a spending cap, sign-in and a live view. Lumen Platform builds these parts once.',
);
shown(
  'Overview',
  '1b  ·  Platform thinking',
  'Producers, consumers, one platform',
  'platform.gif',
  "The platform sits between two groups of users. A producer, the agent author, publishes agents to the registry. A consumer asks: an app with its API key, or people who sign in to the web app. The seed is the run engine. It takes the agent's instructions, runs each question as a task tree, records each step with its cost, and keeps every step under the account's budget cap.",
);
shown(
  'Overview',
  '1c  ·  Scope',
  'Six use cases, all running',
  'usecases.gif',
  "This is the UML use case diagram of the platform. We take one actor at a time, so each actor's use cases are clear. The producer publishes and reads usage. The literature watch app asks and watches. People in the web app manage keys and approve spend over the cap. The operator also reads usage. All six use cases are built.",
);

// ------------------------------------------------------------------ 2 project conduct
shown(
  'Conduct',
  '2a  ·  2b  ·  Status, milestones and effort',
  "We worked to the proposal's plan",
  'milestones.gif',
  'This is the plan from our proposal: ten person-days for each member, from 8 to 21 October. ' +
    'Architecture and the service contracts first, then each service, then autoscaling, the public API and the pipeline. ' +
    'Each member spent about ten person-days, 80 hours, so 400 hours in total, as the proposal planned. ' +
    'Every part is built and runs on AWS.',
);

// ------------------------------------------------------------------ 3 logical architecture
shown(
  'Logical',
  '3a  ·  Key architectural decisions',
  'Three decisions shape the services',
  'decisions.gif',
  'The three key decisions are shown as before and after. AD-01 does not write new services: each slice of main gets a new entry point in the same image. AD-02 puts a durable queue between session and the workers, so a slow model call never holds a request, and any worker can take a turn. AD-04 makes session the only writer of the trace, so a worker that dies loses no step.',
);
shown(
  'Logical',
  '3b  ·  Logical architecture',
  'Five services behind one gateway',
  'logical.gif',
  "The logical architecture has four tiers, and each dependency points down. The clients see one gateway, and the gateway routes to five services. Only Project and Worker call session's internal routes. At run time a question becomes a session, then a turn on the queue. A free worker runs it, and session saves each step. The proposal listed eight services. Traefik is the gateway, the live stream runs inside session, and the model client runs inside the worker, so five services remain, each with one job and its own tables.",
);
shown(
  'Logical',
  '3c  ·  Domain-driven design',
  'Five bounded contexts',
  'contextmap.gif',
  'We found the contexts from the use cases and the nouns that users say. Each context keeps its own aggregates. Each context talks to the others only through domain events, and each arrow shows who sends and who receives. Session comes last, because every event goes through it: it is the core domain.',
);
shown(
  'Logical',
  '3c  ·  Producers and consumers',
  'How apps use the platform',
  'interaction.gif',
  'This sequence diagram shows real calls on the public API v1, in the order they happen. First the producer creates an API key and publishes an agent. Then a consumer lists the agents, asks with one of them, and reads the answer, the findings and the cost. Last, the producer reads usage. Publish, list, ask and read all use one API.',
);

// ------------------------------------------------------------------ 4 physical architecture
shown(
  'Physical',
  '4a  ·  Key architectural decisions',
  'Three choices shape the deployment',
  'physdecisions.gif',
  'Three decisions shape the physical side. The proposal put the chart on EKS; we run the same chart on k3s on one EC2 t3.medium, for about USD 1.3 a day, and the chart can still go to EKS. Two autoscalers watch two kinds of load: HPA adds identity, project and billing pods on CPU, and KEDA adds workers on queue length, because a worker waits on the model and its CPU stays low. One PostgreSQL with a frame per context lets one transaction write the step, its cost and the ledger entry together.',
);
shown(
  'Physical',
  '4b  ·  Physical architecture',
  'One AWS node, one k3s cluster',
  'deployment.gif',
  'The whole platform runs on one AWS node, an EC2 t3.medium in Singapore. k3s runs inside it, and every service, PostgreSQL, RabbitMQ and KEDA run as pods inside k3s. Users reach it only over HTTPS on 443, through Traefik, which routes to the service pods. GitHub Actions deploys over SSH on 22, and only the worker pod talks to the OpenAI API.',
);
shown(
  'Physical',
  '4b  ·  Recorded on the server',
  'Every service is running',
  'rec-pods.gif',
  'This is a recording of the real server. kubectl runs on the server over SSH, because the Kubernetes API is not public. ' +
    'Five services, PostgreSQL and RabbitMQ, and the autoscalers: HPA on CPU for identity, project and billing, and KEDA on queue length for the worker.',
);
shown(
  'Physical',
  '4a  ·  Key architectural decision',
  'One queue for each level of the task tree',
  'queues.gif',
  'AD-03 is about a deadlock that we found in design. With one shared queue, a lead keeps its slot while it waits for its readers, and the readers wait for a free slot. The waits close into a cycle, so no question can finish. A queue per level, with a slot per level, removes one edge of the cycle: the deepest level never waits, so the work always drains.',
);
shown(
  'Physical',
  '4d  ·  Detailed design',
  'Asking a question with a chosen agent',
  'sequence.gif',
  'This is UC2, a question asked with a chosen agent. Project checks the API key, session opens and publishes the root turn, and from that moment two lanes run at the same time. The app gets 201 at once and reads the answer whenever it likes, while a worker takes the turn and runs its steps in a loop. Each step goes back to session, which saves it in PostgreSQL.',
);
shown(
  'Physical',
  '4d  ·  Recorded through the API',
  'A question through the public API',
  'rec-ask.gif',
  'The same use case on the public server, from the command line: POST /api/v1/questions with an API key, then GET /api/v1/questions/:id for the status, the cost and the answer from gpt-4.1-nano.',
);
shown(
  'Physical',
  '4d  ·  Availability, recorded',
  'A worker is deleted; the question still ends',
  'rec-kill.gif',
  'Availability. A question starts, and we force-delete the worker that runs it. Its turn was not acknowledged, so RabbitMQ gives it to another worker, and the question still ends.',
);
shown(
  'Physical',
  '4c  ·  Persistence',
  'The schema, by context',
  'er.gif',
  'Each context owns its own tables in the one PostgreSQL database. Solid lines are foreign keys inside a context; dashed lines are ids that cross a context, with no foreign key, so a later split stays mechanical. The tasks table is the centre: its parent_id is the call tree, and each task has its steps, its findings and its ledger entries. The worker owns no tables; it reports every step to session.',
);

// ------------------------------------------------------------------ 5 DevOps
shown(
  'DevOps',
  '5a  ·  Source and artifacts',
  'From a branch to a running image',
  'branches.gif',
  'ass/platform is our one integration branch. It has 48 commits, and one short-lived branch came back through pull request #148. Every push builds one image tagged with its commit, copies it over SSH into k3s on the EC2 host, and helm puts it live.',
);
shown(
  'DevOps',
  '5b  ·  DevOps pipeline',
  'Six checks around one deploy',
  'pipeline.gif',
  'A push to ass/platform starts the pipeline, and verify, SCA and SAST run at the same time. In the first run the Trivy gate found 5 critical CVEs in the image, so the deploy stopped before the host. The team built a smaller platform image without Docker, and the next run passed every stage, with DAST and a smoke load against the live address, in 12 min 30 s.',
);
shown(
  'DevOps',
  '5b  ·  Recorded on GitHub',
  'The real pipeline runs',
  'rec-pipeline.gif',
  'The real pipeline runs, from the GitHub command line: the list of runs, and every job of one run with its result.',
);
shown(
  'DevOps',
  '5c  ·  Technical findings',
  'What we found, and what we changed',
  'findings.gif',
  'We found three technical problems and fixed each one. One queue for all turns let leads hold every worker slot while their readers waited, so the queue became one queue per level of the task tree. The image with Docker inside failed the Trivy gate, and the smaller platform image passed. KEDA waits 300 s by default before it removes a worker; the chart sets 60 s.',
);

// ------------------------------------------------------------------ 6 demo
shown(
  'Demo',
  '6b  ·  Scalability',
  'KEDA adds workers as the queue grows',
  'scaling.gif',
  "This is the real load test of 20 October, with the paced worker, so it measures the platform's scaling and not the model. When more than 5 jobs wait per worker, KEDA adds a pod, and you see the worker divide as the cursor passes that moment. Four workers stop the queue from growing and then drain it. A minute after the load ends, the extra pods merge back, and all 135 questions finished with no failed request.",
);
shown(
  'Demo',
  '6b  ·  Recorded on the server',
  'On the server: KEDA adds a worker',
  'rec-scale.gif',
  'The same autoscaler on the public server: KEDA compares the jobs per worker with the target of five, and the worker replicas go up, then back down after the load.',
);
{
  const s = newSlide();
  head(s, 'Demo', '6a  ·  6b  ·  Live demo', 'Now, on the public server');
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
    ['Use case', 'ask a question in the browser; watch the call tree grow'],
    ['Use case', 'the watch app publishes its agent and asks; then read usage'],
    ['Scalability', 'run the k6 load test; watch KEDA add workers'],
    ['Availability', 'delete a worker during a question; it still ends'],
    ['Maintainability', 'open the last pipeline run on GitHub'],
  ];
  steps.forEach(([k, t], i) => {
    const y = 3.2 + i * 0.72;
    txt(s, k, { x: 0.6, y, w: 2.6, h: 0.56, fontSize: 18, color: GRAY, valign: 'middle' });
    txt(s, t, { x: 3.3, y, w: 9.4, h: 0.56, fontSize: 22, valign: 'middle' });
  });
  s.addNotes(
    'Live demo, about six minutes, with deploy/k8s/demo.sh and LUMEN_URL set to the address on the slide. ' +
      'Before the load test, switch the workers to the paced worker (gh workflow run platform-deploy.yml -f worker=demo), so the load costs nothing; switch back afterwards. ' +
      'If the network fails, the recorded slides before this one show the same runs.',
  );
}
{
  const s = newSlide();
  txt(s, 'Thank you', {
    x: 0.8,
    y: 2.5,
    w: 11,
    h: 1.3,
    fontSize: 64,
    fontFace: TITLE,
    valign: 'middle',
  });
  txt(s, 'Questions?', { x: 0.8, y: 3.9, w: 11, h: 0.6, fontSize: 28, color: GRAY });
  txt(s, 'https://' + URL, {
    x: 0.8,
    y: 4.8,
    w: 11,
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
