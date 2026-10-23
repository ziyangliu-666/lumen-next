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
// "4a  ·  4b  ·  Live demo" becomes "4  ·  Live demo": the team found letter labels confusing.
const plainItem = (item) => {
  const bits = item.split('  ·  ');
  const nums = bits.filter((b) => /^\d+[a-d]?$/.test(b));
  const rest = bits.filter((b) => !/^\d+[a-d]?$/.test(b));
  return nums.length ? `${nums[0].replace(/[a-d]$/, '')}  ·  ${rest.join('  ·  ')}` : item;
};
function head(s, part, item, title) {
  // A plain running page number, top right, on content slides only (not on the title and end slides).
  s.slideNumber = { x: 11.93, y: 0.42, w: 0.8, h: 0.32, fontSize: 14, color: GRAY, fontFace: SANS, align: 'right' };
  item = plainItem(item);
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
// The speaker notes are the words of script.md ("What to say"), so the Presenter View and the
// script never differ (checklist review, 23 October). The time cues in brackets are dropped.
const SCRIPT = fs.readFileSync(path.join(__dirname, 'script.md'), 'utf8');
function spoken(n) {
  const part = SCRIPT.split(/\n### Slide (\d+):/);
  for (let i = 1; i < part.length; i += 2) {
    if (Number(part[i]) !== n) continue;
    const say = part[i + 1].split('**What to say.**')[1];
    if (!say) return '';
    return say
      .split('\n**')[0]
      .split('\n')
      .filter((l) => l.startsWith('>'))
      .map((l) => l.replace(/^>\s?/, '').replace(/\[[\d.]+ s\]\s*/g, ''))
      .filter((l) => l.trim())
      .join('\n\n');
  }
  return '';
}
// A GIF's size in pixels, from its header.
function gifSize(f) {
  const b = fs.readFileSync(f);
  return [b.readUInt16LE(6), b.readUInt16LE(8)];
}
// One slide, one picture, one title. The drawn diagrams keep an empty band of 0.95 in at their
// top (draw.py TOP): the picture goes under the title, so the band sits behind it and the
// diagram starts just below the title. Recordings have no band; they are fitted and centred.
function shown(part, item, title, file, kind = 'scene') {
  const s = newSlide();
  const n = spec.length;                       // this slide's number, 1-based
  const f = path.join(OUT, file);
  let box;
  if (kind === 'scene') {
    box = { x: 0.6, y: 1.3, w: 12.13, h: 5.0 };
  } else {
    const [pw, ph] = gifSize(f);
    const top = 1.75, room = 7.0 - top;
    const k = Math.min(12.13 / pw, room / ph);
    const w = pw * k, h = ph * k;
    box = { x: 0.6 + (12.13 - w) / 2, y: top, w, h };
  }
  s.addImage({ path: f, ...box });
  cur.items.push({ kind: 'image', file: f, ...box });
  head(s, part, item, title);
  s.addNotes(spoken(n));
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
  txt(s, 'An AI for research, built as a scalable platform', {
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
  txt(s, 'live:  ' + URL, { x: 0.8, y: 6.15, w: 11, h: 0.4, fontSize: 15, fontFace: MONO, color: GRAY });
  s.addNotes(spoken(1));
}

// ------------------------------------------------------------------ 1 overview
shown('Overview', '1  ·  Context and business problem', 'What Lumen does: one question, a tree of agents',
  'lumen-at-work-crop.gif', 'recording');
shown('Overview', '1  ·  Platform thinking', 'Producers and consumers', 'platform.gif');
shown('Overview', '1  ·  Scope', 'Use cases', 'usecases.gif');

// ------------------------------------------------------------------ 2 project conduct
shown('Conduct', '2  ·  Status, milestones and effort', 'Plan and effort', 'milestones.gif');

// ------------------------------------------------------------------ 3 logical architecture
shown('Logical', '3  ·  Key architectural decisions', 'Logical architecture decisions', 'decisions.gif');
shown('Logical', '3  ·  Logical architecture', 'Five services behind the API gateway', 'logical.gif');
shown('Logical', '3  ·  Domain-driven design', 'Bounded contexts', 'contextmap.gif');
shown('Logical', '3  ·  Producers and consumers', 'Public API: the calls in order', 'interaction.gif');

// ------------------------------------------------------------------ 4 physical architecture
shown('Physical', '4  ·  Key architectural decisions', 'Physical architecture decisions', 'physdecisions.gif');
shown('Physical', '4  ·  Physical architecture', 'Deployment diagram', 'deployment.gif');
shown('Physical', '4  ·  Physical architecture', 'Pods on the server (recorded)', 'rec-pods-cut.gif', 'recording');
shown('Physical', '4  ·  Key architectural decisions', 'Decision: one queue per level of the call tree',
  'queues.gif');
shown('Physical', '4  ·  Detailed design', 'Ask a question: sequence diagram', 'sequence.gif');
shown('Physical', '4  ·  Detailed design', 'Ask a question through the public API (recorded)', 'rec-ask.gif',
  'recording');
shown('Physical', '4  ·  Detailed design', 'Availability: deleting a worker (recorded)', 'rec-kill.gif',
  'recording');

shown('Physical', '4  ·  Persistence', 'Database schema', 'er.gif');

// ------------------------------------------------------------------ 5 DevOps
shown('DevOps', '5  ·  Source and artifacts', 'Branches and images', 'branches.gif');
shown('DevOps', '5  ·  DevOps pipeline', 'CI/CD pipeline', 'pipeline.gif');
shown('DevOps', '5  ·  DevOps pipeline', 'Pipeline runs (recorded)', 'rec-pipeline-cut.gif', 'recording');
shown('DevOps', '5  ·  Technical findings', 'Three problems we found and fixed', 'findings.gif');

// ------------------------------------------------------------------ 6 demo
shown('Demo', '6  ·  Scalability', 'Load test: 1 to 4 workers, no failed request', 'scaling.gif');
shown('Demo', '6  ·  Scalability', 'KEDA scaling (recorded)', 'rec-scale-cut.gif', 'recording');
{
  const s = newSlide();
  head(s, 'Demo', '6  ·  Live demo', 'Live demo');
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
    ['Use case', 'ask a question in the browser and watch the call tree grow'],
    ['Use case', 'publish an agent, ask with it from the watch app, read usage'],
    ['Scalability', 'KEDA on the live server'],
    ['Availability', 'delete a worker during a question, and the question still ends'],
    ['Maintainability', 'open the last pipeline run on GitHub'],
  ];
  steps.forEach(([k, t], i) => {
    const y = 3.2 + i * 0.72;
    txt(s, k, { x: 0.6, y, w: 2.6, h: 0.56, fontSize: 18, color: GRAY, valign: 'middle' });
    txt(s, t, { x: 3.3, y, w: 9.4, h: 0.56, fontSize: 22, valign: 'middle' });
  });
  s.addNotes(
    'Live demo, about seven minutes. Follow the run sheet in the speaker script, slide 24. ' +
      'If the live demo fails, play the narrated backup video ASS-Architecting-Scalable-Systems/Team15-Demo-Backup.mp4 (coursework repository) (about 6 minutes). ' +
      'In Zoom, share the screen with computer sound on.',
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
  s.addNotes(spoken(25));
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(spec, null, 1));
pres
  .writeFile({ fileName: path.join(OUT, 'Team15-Lumen-Platform.pptx') })
  .then((f) => console.log(f, spec.length, 'slides'));
