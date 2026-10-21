// The ASS presentation deck (docs/platform/slides/README.md has the rules).
// Layout and colours follow the interview deck (~/Projects/interview-deck/deck/build.js):
// a red label, one short title, one large animation; dark section slides with a tracker.
//
//   node docs/platform/slides/build.js
//
// It writes out/Team15-Lumen-Platform.pptx and out/slides.json, a plain description of
// every slide that preview.py draws, so the layout can be checked without PowerPoint.
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const INK = '1A1D23',
  RED = 'C8102E',
  GRAY = '5F6670',
  EDGE = '9AA0A8',
  LIGHT = 'F2F3F5',
  WHITE = 'FFFFFF',
  SOFT = 'A3A9B1';
const FONT = 'Arial';
const OUT = path.join(__dirname, 'out');
const URL = 'lumen.54-179-112-87.sslip.io';
const gif = (n) => path.join(OUT, n + '.gif');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inches
pres.author = 'Team 15';
pres.title = 'Lumen Platform';

const spec = []; // what preview.py draws
let cur = null;
const newSlide = (bg) => {
  const s = pres.addSlide();
  if (bg) s.background = { color: bg };
  cur = { bg: bg || WHITE, items: [] };
  spec.push(cur);
  return s;
};
const txt = (s, text, o) => {
  s.addText(text, { fontFace: FONT, isTextBox: true, margin: 0, valign: 'top', color: INK, ...o });
  cur.items.push({
    kind: 'text',
    text: typeof text === 'string' ? text : text.map((r) => r.text).join(''),
    ...o,
  });
};
const rect = (s, x, y, w, h, fill, line) => {
  s.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: { color: line || fill, width: 1.25 },
  });
  cur.items.push({ kind: 'rect', x, y, w, h, fill, line: line || fill });
};
const picture = (s, file, x, y, w, h) => {
  s.addImage({ path: file, x, y, w, h });
  cur.items.push({ kind: 'image', file, x, y, w, h });
};

const PARTS = ['Overview', 'Architecture', 'Scale', 'Delivery'];
function tracker(s, n, y, dark) {
  const pw = (11.93 - 0.3 * (PARTS.length - 1)) / PARTS.length;
  PARTS.forEach((p, i) => {
    const x = 0.7 + i * (pw + 0.3),
      on = i + 1 === n;
    rect(s, x, y, pw, 0.7, on ? RED : dark ? INK : WHITE, on ? RED : dark ? GRAY : EDGE);
    txt(s, `${i + 1}  ${p}`, {
      x,
      y,
      w: pw,
      h: 0.7,
      fontSize: 16,
      bold: on,
      color: on ? WHITE : dark ? SOFT : GRAY,
      align: 'center',
      valign: 'middle',
    });
  });
}

function section(n, title, sub, notes) {
  const s = newSlide(INK);
  txt(s, `PART ${n} OF ${PARTS.length}`, {
    x: 0.8,
    y: 2.0,
    w: 11,
    h: 0.45,
    fontSize: 20,
    bold: true,
    color: RED,
    charSpacing: 3,
  });
  txt(s, title, {
    x: 0.8,
    y: 2.55,
    w: 11.7,
    h: 1.2,
    fontSize: 54,
    bold: true,
    color: WHITE,
    valign: 'middle',
  });
  txt(s, sub, { x: 0.8, y: 3.85, w: 11.7, h: 0.5, fontSize: 22, color: SOFT });
  tracker(s, n, 5.85, true);
  s.addNotes(notes);
}

// A slide with one animation: a red label, a title of a few words, the GIF under it.
function shown(label, title, name, notes) {
  const s = newSlide();
  txt(s, label, {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: RED,
    charSpacing: 2,
  });
  txt(s, title, { x: 0.6, y: 0.72, w: 12.1, h: 0.75, fontSize: 32, bold: true, valign: 'middle' });
  picture(s, gif(name), 0.6, 1.9, 12.13, 5.0);
  s.addNotes(notes);
}

// ------------------------------------------------------------------ 1. title
{
  const s = newSlide(INK);
  txt(s, 'ARCHITECTING SCALABLE SYSTEMS · TEAM 15', {
    x: 0.8,
    y: 1.9,
    w: 11.7,
    h: 0.45,
    fontSize: 18,
    bold: true,
    color: RED,
    charSpacing: 3,
  });
  txt(s, 'Lumen Platform', {
    x: 0.8,
    y: 2.45,
    w: 11.7,
    h: 1.3,
    fontSize: 60,
    bold: true,
    color: WHITE,
    valign: 'middle',
  });
  txt(s, 'A platform for teams of AI research agents', {
    x: 0.8,
    y: 3.8,
    w: 11.7,
    h: 0.6,
    fontSize: 26,
    color: SOFT,
  });
  txt(s, 'He Rong  ·  Li Zhuoyang  ·  Liu Ziyang  ·  Lu Yi  ·  Peng Xujian', {
    x: 0.8,
    y: 5.6,
    w: 11.7,
    h: 0.45,
    fontSize: 18,
    color: WHITE,
  });
  txt(s, URL, { x: 0.8, y: 6.15, w: 11.7, h: 0.4, fontSize: 16, color: SOFT });
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
  'OVERVIEW · THE PROBLEM',
  'One chat window is not enough',
  'problem',
  'A researcher who uses an AI model today works in one chat window. Three problems. ' +
    'One: it does one thing at a time, so a question with five parts takes five rounds. ' +
    'Two: a long conversation fills the window, and the first messages fall out without warning. ' +
    'Three: nobody sees the cost until the bill arrives. ' +
    'Lumen gives the question to a team of agents instead: a lead agent splits it, and readers work on the parts at the same time.',
);

shown(
  'OVERVIEW · WHAT LUMEN DOES',
  'A team of agents for each question',
  'tree',
  'This is one question in Lumen. You ask it. A lead agent plans and splits the work. Three readers work in parallel. ' +
    'Every small square is a step an agent took, and every step is recorded with its cost. ' +
    'The cost adds up against a cap on the account: one US dollar by default. The findings and the answer come back to you. ' +
    'Numbers on this picture are from a real question on our server: 3 cents, 3 findings.',
);

shown(
  'OVERVIEW · THE PLATFORM',
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
  txt(s, 'OVERVIEW · PROJECT CONDUCT', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: RED,
    charSpacing: 2,
  });
  txt(s, 'Five people, one part each', {
    x: 0.6,
    y: 0.72,
    w: 12.1,
    h: 0.75,
    fontSize: 32,
    bold: true,
    valign: 'middle',
  });
  const team = [
    ['Liu Ziyang', 'session service, the queue protocol, integration'],
    ['Li Zhuoyang', 'workers'],
    ['Lu Yi', 'sign-in, API keys, gateway, HTTPS'],
    ['Peng Xujian', 'projects, agent registry, second app, load test'],
    ['He Rong', 'billing, Kubernetes, the pipeline'],
  ];
  team.forEach(([who, what], i) => {
    const y = 1.95 + i * 0.95;
    rect(s, 0.6, y, 3.4, 0.75, INK);
    txt(s, who, {
      x: 0.6,
      y,
      w: 3.4,
      h: 0.75,
      fontSize: 18,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
    });
    txt(s, what, { x: 4.3, y, w: 8.4, h: 0.75, fontSize: 18, color: INK, valign: 'middle' });
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
  'ARCHITECTURE · SERVICES',
  'Five services, one queue of work',
  'services',
  'Five services sit behind one gateway, and each can run as many copies as it needs. ' +
    'Follow one question: the gateway sends it to the project service, which opens a session. ' +
    'The session service does not do the work itself: it puts the work in a queue, which is a waiting line. ' +
    'A worker takes the work from the queue and does it, and every step goes back through the session service to the screen. ' +
    'When more work waits, more workers start. All services share one PostgreSQL database; the queue is RabbitMQ.',
);

shown(
  'ARCHITECTURE · ONE DECISION',
  'One queue per level of the tree',
  'depth',
  'One design decision that matters. A lead waits for its readers, and while it waits it keeps its worker busy. ' +
    'With a single queue, two leads can take both workers; their readers then wait in the queue for a worker that never comes free. ' +
    'Everything stops. Our fix is one queue for each level of the tree. Leads take lead slots, readers have their own slots, ' +
    'and the deepest level never waits for anything, so the work always drains.',
);

shown(
  'ARCHITECTURE · WHERE IT RUNS',
  'One public server on AWS',
  'hosting',
  'It runs on one small server in AWS, in Singapore: a t3.medium, about 1.3 US dollars a day. ' +
    'Kubernetes, in its small k3s version, runs every service on it and restarts what fails. ' +
    "HTTPS comes from a free Let's Encrypt certificate that renews itself. " +
    'A push to GitHub deploys a new version, after the checks we show in part 4. ' +
    'For the report we explain why one server and not EKS: cost and time; the same setup moves to EKS unchanged.',
);

shown(
  'ARCHITECTURE · SECURITY',
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
  'SCALE · LOAD TEST',
  'Load grows, workers follow',
  'scale',
  'This is a recording of a real load test on our public server, on 20 October. Ten users ask questions as fast as they can. ' +
    'The blue bars are the jobs waiting in the queue. One worker cannot keep up, so the queue grows. ' +
    'KEDA watches the queue and starts more copies of the worker: one, two, three, four, in about 50 seconds. ' +
    'When the load ends, it goes back to one. Result: 135 questions, all answered, median 6.1 seconds, none of the 1,040 requests failed.',
);

shown(
  'SCALE · FAILURE',
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
  'DELIVERY · PIPELINE',
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
  txt(s, 'DELIVERY · LIVE DEMO', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: RED,
    charSpacing: 2,
  });
  txt(s, 'Now, on the public server', {
    x: 0.6,
    y: 0.72,
    w: 12.1,
    h: 0.75,
    fontSize: 32,
    bold: true,
    valign: 'middle',
  });
  rect(s, 0.6, 1.85, 12.13, 0.95, LIGHT);
  txt(s, 'https://' + URL, {
    x: 0.6,
    y: 1.85,
    w: 12.13,
    h: 0.95,
    fontSize: 30,
    bold: true,
    color: RED,
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
    const y = 3.25 + i * 0.85;
    rect(s, 0.6, y, 0.62, 0.62, RED);
    txt(s, String(i + 1), {
      x: 0.6,
      y,
      w: 0.62,
      h: 0.62,
      fontSize: 20,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
    });
    txt(s, t, { x: 1.45, y, w: 11, h: 0.62, fontSize: 24, valign: 'middle' });
  });
  s.addNotes(
    'Live demo, about eight minutes. Run deploy/k8s/demo.sh with LUMEN_URL set to the address on the slide. ' +
      'One: ask a question in the browser. Two: watch the tree grow, step by step, with its cost. ' +
      'Three: start the load test and show the workers going from 1 to 4 (kubectl get pods), then back. ' +
      'Four: run the literature watch, which asks through the public API with an API key. ' +
      'If the network fails, play the animations on the previous slides; they show the same runs.',
  );
}

{
  const s = newSlide();
  txt(s, 'WHAT IS NEXT', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: RED,
    charSpacing: 2,
  });
  txt(s, 'Three limits, and what we do next', {
    x: 0.6,
    y: 0.72,
    w: 12.1,
    h: 0.75,
    fontSize: 32,
    bold: true,
    valign: 'middle',
  });
  const rows = [
    ['One copy of the session service', 'Keep live work in the database, then run many copies'],
    ['One database for every service', 'One database for each service'],
    ["A killed worker's jobs run twice", 'Make every job safe to repeat'],
  ];
  rows.forEach(([limit, next], i) => {
    const y = 2.05 + i * 1.45;
    rect(s, 0.6, y, 5.6, 1.05, LIGHT);
    txt(s, limit, { x: 0.85, y, w: 5.2, h: 1.05, fontSize: 20, bold: true, valign: 'middle' });
    txt(s, '→', {
      x: 6.3,
      y,
      w: 0.6,
      h: 1.05,
      fontSize: 28,
      bold: true,
      color: RED,
      align: 'center',
      valign: 'middle',
    });
    rect(s, 7.0, y, 5.73, 1.05, WHITE, EDGE);
    txt(s, next, { x: 7.25, y, w: 5.3, h: 1.05, fontSize: 20, valign: 'middle' });
  });
  s.addNotes(
    'Three limits we know about. The session service runs as one copy, because it keeps running work in memory; the next step is to keep it in the database. ' +
      'All services share one database; the tables are already separated per service, so one database each is the next step. ' +
      "And a killed worker's jobs run twice; we make jobs safe to repeat. The report lists all thirteen limits, each with a fix.",
  );
}

{
  const s = newSlide(INK);
  txt(s, 'Thank you', {
    x: 0.8,
    y: 2.4,
    w: 11.7,
    h: 1.3,
    fontSize: 60,
    bold: true,
    color: WHITE,
    valign: 'middle',
  });
  txt(s, 'https://' + URL, { x: 0.8, y: 3.85, w: 11.7, h: 0.6, fontSize: 26, color: SOFT });
  txt(s, 'Questions?', { x: 0.8, y: 4.7, w: 11.7, h: 0.6, fontSize: 26, color: RED, bold: true });
  s.addNotes('Thank you. We are happy to take questions.');
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(spec, null, 1));
pres
  .writeFile({ fileName: path.join(OUT, 'Team15-Lumen-Platform.pptx') })
  .then((f) => console.log(f, spec.length, 'slides'));
