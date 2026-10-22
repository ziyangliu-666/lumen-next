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
    'On the right, the call tree grows, every task shows what it cost, and each reader records its paper as a finding.',
);
shown(
  'Overview',
  '1b  ·  Platform thinking',
  'Producers, consumers, one platform',
  'platform.gif',
  "Lumen is a platform with two sides. Producers are agent authors: they publish an agent in the registry. Consumers ask questions, either from an app with an API key, like our literature watch, or as people in the web app. The seed is the run engine. It runs every question as a task tree, records each step with its cost, and stops at the account's budget cap. The consumer gets back the answer, the findings and the cost.",
);
shown(
  'Overview',
  '1c  ·  Scope',
  'Six use cases, all running',
  'usecases.gif',
  'This is our scope: the six use cases of the proposal, all built and running on the public server. A producer publishes an agent and reads its usage. An app asks questions with a chosen agent, and the literature watch asks saved questions on a schedule. The account owner manages API keys and approves any step that would pass the cap. The operator reads usage for every account and agent.',
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
  'Three decisions shaped the logical design. First, we cut the five services along the slices that already existed, so each slice kept its ports and its tests. Second, a turn goes from session to the workers on a durable RabbitMQ queue, not a direct call. A slow model call never holds a web request, and if a worker dies, its turn stays on the queue for another worker. Third, only session writes the trace: workers report each step over /internal, so a worker that dies loses no step.',
);
shown(
  'Logical',
  '3b  ·  Logical architecture',
  'Five services behind one gateway',
  'logical.gif',
  'The logical architecture has four tiers. Clients: the web app and the literature watch app. The edge: Traefik as the API gateway. ' +
    'Five services: identity, project, session, worker and billing. The data: PostgreSQL and RabbitMQ. ' +
    'Follow one question: the app calls the gateway, project opens a session, session puts a turn on a durable queue, ' +
    'any free worker takes it and runs the agent against the LLM, every step goes back to session and into PostgreSQL, and the app reads the answer.',
);
shown(
  'Logical',
  '3c  ·  Domain-driven design',
  'Five bounded contexts',
  'contextmap.gif',
  'We found the contexts from the use cases. We took the nouns our users say, grouped the ones that belong together, and each group became a bounded context with its aggregates. Session is the core domain: it owns the task tree and every step. The contexts talk through domain events: a question asked starts a session, a turn queued goes to execution, and every step recorded comes back to session. Spend recorded and approval needed go to billing, and finding recorded goes back to the project.',
);
shown(
  'Logical',
  '3c  ·  Producers and consumers',
  'How apps use the platform',
  'interaction.gif',
  "This is the whole platform contract, seven calls on the public API. A producer creates a key and publishes an agent. A consumer app lists the agents and asks a question with the one it chose, and gets a session id at once. The platform runs the question with the agent's instructions in front, and the app reads the answer, the findings and the cost. Producers and the operator read usage from the same API: sessions, cost, and the median time to rest per agent.",
);

// ------------------------------------------------------------------ 4 physical architecture
shown(
  'Physical',
  '4a  ·  Key architectural decisions',
  'Three choices shape the deployment',
  'physdecisions.gif',
  'Three decisions shape the physical architecture. First, k3s on one EC2 t3.medium instead of EKS: the same Helm chart runs on a laptop and on AWS, for about 1.3 dollars a day. ' +
    'Second, two autoscalers: HPA on CPU for identity, project and billing, and KEDA on queue length for the worker, because a worker waits on the model and its CPU stays low while the queue grows. ' +
    'Third, one PostgreSQL database with tables per context, so a step, its cost and its ledger entry are written in one transaction.',
);
shown(
  'Physical',
  '4b  ·  Physical architecture',
  'One AWS node, one k3s cluster',
  'deployment.gif',
  'The physical architecture as a UML deployment diagram. One EC2 t3.medium in Singapore runs k3s; we chose k3s over EKS, so the same Helm chart runs on a laptop and on AWS. ' +
    'The security group opens 22, 80 and 443 only. Traefik ends HTTPS and routes to five service deployments; ' +
    'identity, project and billing scale on CPU with HPA, the worker scales on queue length with KEDA, and session runs one copy. ' +
    'PostgreSQL and RabbitMQ are StatefulSets with volumes. GitHub Actions deploys over SSH, and the worker calls the OpenAI API over HTTPS.',
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
  'A lead turn keeps its worker slot while its readers run. With one shared queue, two questions are enough to fill both slots with waiting leads. Their readers then sit in the queue, and no worker is free to take them: that is a deadlock. So we gave each level of the task tree its own queue and its own slots on every worker; in the real system each worker has four slots per level. The leads wait in the level-0 slots, the readers run in the level-1 slots, and every question finishes.',
);
shown(
  'Physical',
  '4d  ·  Detailed design',
  'Asking a question with a chosen agent',
  'sequence.gif',
  'This is use case A: a consumer asks a question with an agent that a producer published. The request comes through Traefik to the project service. The key guard checks the key, its rate and its scope, and then project asks session to open the session. Session puts the root turn on lumen.turns.0, and the client gets 201 at once. Any worker takes the turn. For each step it calls the model and posts the step to session, which writes it to PostgreSQL. The client then reads the answer with a GET.',
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
  '4c  ·  Persistence',
  'The schema, by context',
  'er.gif',
  "All persistent data is in one PostgreSQL 16 database, AD-06, and each context owns its tables: the frames show the owner; the worker owns none. Inside a context, tables use foreign keys. Across contexts most references are plain ids, and a few foreign keys cross: findings point to sessions and tasks, ledger entries point to tasks, and an agent points to its owner's account. The task tree is one table with a parent link, so the cost roll-up is SQL. Money is numeric(12,6). Turns in flight are in RabbitMQ, and the agents' files are on a 2Gi volume.",
);

// ------------------------------------------------------------------ 5 DevOps
shown(
  'DevOps',
  '5a  ·  Source and artifacts',
  'From a branch to a running image',
  'branches.gif',
  'We use one repository. main holds Lumen, and ass/platform is our integration branch. Each member works on one branch and merges it back through a pull request. Every push to ass/platform builds one image, tagged with the commit SHA, from deploy/k8s/Dockerfile. The pipeline copies that image to the EC2 host over SSH, imports it into k3s, and deploys it with helm upgrade, so there is no registry to run.',
);
shown(
  'DevOps',
  '5b  ·  DevOps pipeline',
  'Six checks around one deploy',
  'pipeline.gif',
  'Every push to ass/platform runs this pipeline. Tests, a dependency audit and CodeQL run in parallel. Only then does the deploy job build the image and scan it with Trivy. In our first run the gate found five critical CVEs and stopped the deploy, so the image never reached the host. That is the pipeline doing its job. We built a smaller platform image without Docker inside, and in the next run every stage passed; all jobs were done in 12 minutes 30 seconds.',
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
  "Three findings changed the design. First, one queue for all turns can deadlock, because parents hold every worker slot while their children wait behind them, so we gave each depth of the task tree its own queue. Second, the image scan stopped an image that carried Docker for Lumen's sandbox, and the platform does not need Docker, so we built a smaller platform image, patched at build. Third, KEDA's autoscaler waits five minutes before it scales down by default, and we set it to one minute, so the workers return to one soon after the load.",
);

// ------------------------------------------------------------------ 6 demo
shown(
  'Demo',
  '6b  ·  Scalability',
  'KEDA adds workers as the queue grows',
  'scaling.gif',
  "This is our k6 load test on the public host, with the paced worker that makes no model calls, so the test measures how the platform scales and not how fast the model answers. Ten users ask questions without pause. The bars are the jobs waiting in the queues, and the dashed line is KEDA's target of five jobs per worker. When the queue passes that line, KEDA adds a worker pod, and it went from one to four in 49 seconds. After the load stops, the queue empties, and a minute later KEDA scales back to one worker. All 135 questions finished with a median of 6.1 seconds, and none of the 1,040 requests failed.",
);
shown(
  'Demo',
  '6b  ·  Recorded on the server',
  'On the server: KEDA adds a worker',
  'rec-scale.gif',
  'The same autoscaler on the public server: KEDA compares the jobs per worker with the target of five, and the worker replicas go up, then back down after the load.',
);
shown(
  'Demo',
  '6b  ·  Availability, recorded',
  'A worker is deleted; the question still ends',
  'rec-kill.gif',
  'Availability. A question starts, and we force-delete the worker that runs it. Its turn was not acknowledged, so RabbitMQ gives it to another worker, and the question still ends.',
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
    ['Use case', 'the literature watch app asks through the API'],
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
    'Live demo, about eight minutes, with deploy/k8s/demo.sh and LUMEN_URL set to the address on the slide. ' +
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
