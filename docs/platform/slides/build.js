// The ASS presentation deck (docs/platform/slides/README.md has the rules).
// Drawn in lumen's own dark theme (apps/web/src/styles/theme.css): black ground, white
// ink, grey secondary text, thin grey rules, zero radius, Switzer, and no red: red means
// "waits on you", and nothing on a slide does. The telling keeps the interview deck's
// way: a small label, one short title, one large animation, the rest in the notes.
// Switzer must be installed where the deck is shown (see the README).
//
//   node docs/platform/slides/build.js
//
// It writes out/Team15-Lumen-Platform.pptx and out/slides.json, a plain description of
// every slide that preview.py draws, so the layout is checked without PowerPoint.
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

// theme.css, .dark: paper, ink, ink-2, ink-3, rule-major, well.
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

const spec = []; // what preview.py draws
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
const label = (s, t) => txt(s, t, { x: 0.6, y: 0.42, w: 12, h: 0.32, fontSize: 14, color: GRAY });
const heading = (s, t) =>
  txt(s, t, { x: 0.6, y: 0.78, w: 12.1, h: 0.8, fontSize: 34, fontFace: TITLE, valign: 'middle' });

// The progress, as at the bottom of lumen's intro: a row of thin segments, the current
// one white, with each part's name under it.
const PARTS = ['Overview', 'Architecture', 'Scale', 'Delivery'];
function progress(s, n, y) {
  const pw = 2.7;
  PARTS.forEach((p, i) => {
    const x = 0.8 + i * (pw + 0.25),
      on = i + 1 === n;
    rect(s, x, y, pw, 0.04, on ? INK : RULE);
    txt(s, p, { x, y: y + 0.14, w: pw, h: 0.35, fontSize: 14, color: on ? INK : SOFT });
  });
}

function section(n, title, sub, notes) {
  const s = newSlide('field.png');
  txt(s, `Part ${n} of ${PARTS.length}`, {
    x: 0.8,
    y: 2.0,
    w: 11,
    h: 0.45,
    fontSize: 18,
    color: GRAY,
  });
  txt(s, title, {
    x: 0.8,
    y: 2.5,
    w: 11.7,
    h: 1.3,
    fontSize: 60,
    fontFace: TITLE,
    valign: 'middle',
  });
  txt(s, sub, { x: 0.8, y: 3.85, w: 11.7, h: 0.5, fontSize: 24, color: GRAY });
  progress(s, n, 6.2);
  s.addNotes(notes);
}

// A slide with one animation: a label, a title of a few words, the GIF under it.
function shown(kicker, title, name, notes) {
  const s = newSlide();
  label(s, kicker);
  heading(s, title);
  picture(s, gif(name), 0.6, 1.9, 12.13, 5.0);
  s.addNotes(notes);
}

// ------------------------------------------------------------------ 1. title
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
    'Good morning. We are Team 15. Our project is Lumen Platform: a platform on which teams of AI agents do research work. ' +
      'Everything we show today runs on a public server; the address is on the slide, and you can open it now.',
  );
}

// ------------------------------------------------------------------ part 1
section(
  1,
  'Overview',
  'What we built, and why',
  'First, the problem, what Lumen does, and why it is a platform.',
);

shown(
  'Overview  ·  The problem',
  'One chat window is not enough',
  'problem',
  'A researcher who uses an AI model today works in one chat window. Three problems. ' +
    'One: it does one thing at a time, so a question with five parts takes five rounds. ' +
    'Two: a long conversation fills the window, and the first messages fall out without warning. ' +
    'Three: nobody sees the cost until the bill arrives. ' +
    'Lumen gives the question to a team of agents instead: a lead agent splits it, and readers work on the parts at the same time.',
);

shown(
  'Overview  ·  What Lumen does',
  'A team of agents for each question',
  'tree',
  'This is one question in Lumen. You ask it. A lead agent plans and splits the work. Three readers work in parallel. ' +
    'Every sphere is an agent, and every small block is a step it took; every step is recorded with its cost. ' +
    'The cost adds up against a cap on the account: one US dollar by default. The findings and the answer come back to you. ' +
    'The numbers are from a real question on our server: 3 cents, 3 findings.',
);

shown(
  'Overview  ·  The platform',
  'Producers, consumers, one platform',
  'platform',
  'Lumen is a platform, not only an app. Producers publish agents: an agent is a set of instructions for the lead, for one kind of question. ' +
    'Consumers ask questions and pick an agent. An app gets an API key that says what it may do. ' +
    'The platform runs the work, records every step and bills it. ' +
    'Our second app, a literature watch, is about 210 lines: it has no database, no model and no billing of its own, because the platform does that. ' +
    'That is the benefit of building on a platform.',
);

{
  const s = newSlide();
  label(s, 'Overview  ·  Project conduct');
  heading(s, 'Five people, one part each');
  const team = [
    ['Liu Ziyang', 'session service, the queue protocol, integration'],
    ['Li Zhuoyang', 'workers'],
    ['Lu Yi', 'sign-in, API keys, gateway, HTTPS'],
    ['Peng Xujian', 'projects, agent registry, second app, load test'],
    ['He Rong', 'billing, Kubernetes, the pipeline'],
  ];
  team.forEach(([who, what], i) => {
    const y = 2.05 + i * 0.95;
    rect(s, 0.6, y - 0.12, 12.13, 0.01, RULE);
    txt(s, who, { x: 0.6, y, w: 3.4, h: 0.6, fontSize: 22, fontFace: BOLD, valign: 'middle' });
    txt(s, what, { x: 4.3, y, w: 8.4, h: 0.6, fontSize: 20, color: GRAY, valign: 'middle' });
  });
  s.addNotes(
    'Each of us owns one part from design to deployment. Status today: everything you will see is built and running on the public server. ' +
      "Before the talk, each member states the hours they spent [TEAM TO FILL: hours per member, from the report's section 2.3].",
  );
}

// ------------------------------------------------------------------ part 2
section(
  2,
  'Architecture',
  'How it is built, and where it runs',
  'Now the architecture: the services, one decision that matters, where it runs, and how apps are let in.',
);

shown(
  'Architecture  ·  Services',
  'Five services, one queue of work',
  'services',
  'Five services sit behind one gateway, and each can run as many copies as it needs. ' +
    'Follow one question: the gateway sends it to the project service, which opens a session. ' +
    'The session service does not do the work itself: it puts the work in a queue, which is a waiting line. ' +
    'A worker takes the work from the queue and does it, and every step goes back through the session service to the screen. ' +
    'When more work waits, more workers start. All services share one PostgreSQL database; the queue is RabbitMQ.',
);

shown(
  'Architecture  ·  One decision',
  'One queue per level of the tree',
  'depth',
  'One design decision that matters. A lead waits for its readers, and while it waits it keeps its worker busy. ' +
    'With a single queue, two leads can take both workers; their readers then wait in the queue for a worker that never comes free. ' +
    'Everything stops. Our fix is one queue for each level of the tree. Leads take lead slots, readers have their own slots, ' +
    'and the deepest level never waits for anything, so the work always drains.',
);

shown(
  'Architecture  ·  Where it runs',
  'One public server on AWS',
  'hosting',
  'It runs on one small server in AWS, in Singapore: a t3.medium, about 1.3 US dollars a day. ' +
    'Kubernetes, in its small k3s version, runs every service on it and restarts what fails. ' +
    "HTTPS comes from a free Let's Encrypt certificate that renews itself. " +
    'A push to GitHub deploys a new version, after the checks we show in part 4. ' +
    'For the report we explain why one server and not EKS: cost and time; the same setup moves to EKS unchanged.',
);

shown(
  'Architecture  ·  Security',
  'What an API key may do',
  'keys',
  'Apps get a key, not a password. The key carries scopes, and it is stored only as a hash, so we cannot read it back. ' +
    "Inside its scopes it works. On the web app's own pages it is refused with 403, so a key can never act as a signed-in person. " +
    'And each key may send 60 requests a minute, 20 at once; past that it gets 429, slow down. ' +
    'Other controls: HTTPS everywhere, internal calls between services carry a secret and are never routed from outside, and every container runs without root.',
);

// ------------------------------------------------------------------ part 3
section(
  3,
  'Scale',
  'Does it hold up?',
  'Part 3: two tests on the public server. More load, and a failure.',
);

shown(
  'Scale  ·  Load test',
  'Load grows, workers follow',
  'scale',
  'This is a recording of a real load test on our public server, on 20 October. Ten users ask questions as fast as they can. ' +
    'The bars are the jobs waiting in the queue. One worker cannot keep up, so the queue grows. ' +
    'KEDA watches the queue and starts more copies of the worker: one, two, three, four, in about 50 seconds. ' +
    'When the load ends, it goes back to one. Result: 135 questions, all answered, median 6.1 seconds, none of the 1,040 requests failed.',
);

shown(
  'Scale  ·  Failure',
  'A worker dies; the question still ends',
  'kill',
  'What if a worker dies in the middle of a question? We killed one on purpose, with no time to finish. ' +
    'A job leaves the queue for good only when its worker says it is done. So the three jobs went back to the queue, ' +
    'Kubernetes started a new worker, it took them, and the question ended 12.6 seconds after it was asked. ' +
    'The price: those three jobs ran twice, so the question cost 8 cents instead of 3. Making jobs safe to repeat is our next step.',
);

// ------------------------------------------------------------------ part 4
section(
  4,
  'Delivery',
  'From a push to a live server',
  'Part 4: how a change reaches the server, then the live demo.',
);

shown(
  'Delivery  ·  Pipeline',
  'Seven checks on every push',
  'pipeline',
  'Every push goes through seven checks: the tests, a check of the libraries we use, a scan of our code, a scan of the built image, ' +
    'the deploy, an attack test against the live server with OWASP ZAP, and a small load test. ' +
    'Nothing reaches the server unless the checks before it pass. This has already worked once: ' +
    'the image scan found five critical security issues in programs we did not need, and stopped the deploy. ' +
    'We built a smaller image without them, and the next run passed every check: 12.5 minutes from push to a tested public server.',
);

{
  const s = newSlide();
  label(s, 'Delivery  ·  Live demo');
  heading(s, 'Now, on the public server');
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
    'Watch the tree grow',
    'Load: the workers go from 1 to 4',
    'The second app asks through the API',
  ];
  steps.forEach((t, i) => {
    const y = 3.3 + i * 0.85;
    txt(s, String(i + 1), {
      x: 0.6,
      y,
      w: 0.6,
      h: 0.62,
      fontSize: 24,
      fontFace: TITLE,
      color: GRAY,
      valign: 'middle',
    });
    txt(s, t, { x: 1.3, y, w: 11, h: 0.62, fontSize: 26, valign: 'middle' });
  });
  s.addNotes(
    'Live demo, about eight minutes. Run deploy/k8s/demo.sh with LUMEN_URL set to the address on the slide. ' +
      'One: ask a question in the browser. Two: watch the tree grow, step by step, with its cost. ' +
      'Three: switch the workers to demo mode first (gh workflow run platform-deploy.yml -f worker=demo), start the load test and show the workers going from 1 to 4, then back. ' +
      'Four: run the literature watch, which asks through the public API with an API key. ' +
      'If the network fails, play the animations on the previous slides; they show the same runs.',
  );
}

{
  const s = newSlide();
  label(s, 'What is next');
  heading(s, 'Three limits, and what we do next');
  const rows = [
    ['One copy of the session service', 'Keep live work in the database, then run many copies'],
    ['One database for every service', 'One database for each service'],
    ["A killed worker's jobs run twice", 'Make every job safe to repeat'],
  ];
  rows.forEach(([limit, next], i) => {
    const y = 2.1 + i * 1.45;
    rect(s, 0.6, y, 5.6, 1.05, WELL);
    txt(s, limit, { x: 0.85, y, w: 5.2, h: 1.05, fontSize: 20, fontFace: BOLD, valign: 'middle' });
    txt(s, '→', {
      x: 6.3,
      y,
      w: 0.6,
      h: 1.05,
      fontSize: 28,
      color: GRAY,
      align: 'center',
      valign: 'middle',
    });
    rect(s, 7.0, y, 5.73, 1.05, null, RULE);
    txt(s, next, { x: 7.25, y, w: 5.3, h: 1.05, fontSize: 20, valign: 'middle' });
  });
  s.addNotes(
    'Three limits we know about. The session service runs as one copy, because it keeps running work in memory; the next step is to keep it in the database. ' +
      'All services share one database; the tables are already separated per service, so one database each is the next step. ' +
      "And a killed worker's jobs run twice; we make jobs safe to repeat. The report lists all thirteen limits, each with a fix.",
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
