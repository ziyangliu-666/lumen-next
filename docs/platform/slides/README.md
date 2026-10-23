# The presentation deck

The deck for the ASS presentation on 26 October 2026. The pictures do the
explaining; the words on a slide only name what the picture shows.

```sh
python3 docs/platform/slides/make.py          # draw every animation into out/
python3 docs/platform/slides/make.py depth    # or only the scenes you name
node docs/platform/slides/build.js            # write out/Team15-Lumen-Platform.pptx
python3 docs/platform/slides/preview.py       # draw every slide into out/preview/
```

`build.js` needs `pptxgenjs` (`npm install --prefix docs/platform/slides`).
`make.py` and `preview.py` need Pillow and NumPy.

The `rec-*` GIFs are real terminal recordings of the public server. Record them
one at a time with asciinema, then render them with agg:

```sh
docs/platform/slides/tapes/record.sh pods     # writes out/casts/pods.cast
docs/platform/slides/tapes/render.sh pods     # writes out/rec-pods.gif
```

The deck uses cut versions of some recordings: `make.py atwork` enlarges slide 2 and ends
it on the frame with all three readers; `make.py recpods recscale recpipeline` trim the
empty part of a terminal recording and drop the columns that only hold internal names.
Each drawn GIF plays once and holds its last frame; `make.py` writes the start of each
step to `out/steps/<name>.txt`, and the time cues of `script.md` come from there.

The order of the slides follows the course outline: overview (problem,
platform thinking, scope), project conduct, logical architecture (decisions,
how the contexts were found, the contexts, the services), physical
architecture (decisions, hosting, persistence, schema, one use case in
detail), DevOps (source, pipeline, findings), and the demo.

The slides name Switzer (Regular, Medium, Semibold) and JetBrains Mono. The computer
that shows the deck needs them installed, or PowerPoint falls back to another sans.
The site serves them as variable woff2 files (`apps/web/public/fonts`); make static
TTF files from them and install those:

```sh
python3 -m venv /tmp/fontvenv && /tmp/fontvenv/bin/pip install fonttools brotli
/tmp/fontvenv/bin/fonttools varLib.instancer apps/web/public/fonts/switzer.woff2 wght=500 -o Switzer-Medium.ttf
```

Do the same for `wght=400` and `wght=600`, rename each family to "Switzer",
"Switzer Medium" and "Switzer Semibold", and copy the files to `~/Library/Fonts`.

## The redesign (21 October 2026, later the same day)

The rules below this section were replaced after the user watched the deck as an
audience would. A symbol only means what we think it means because of our own
context: nobody in the room can tell that a halftone ball is an agent, or why
coins drop into a wallet. So the deck now follows these rules.

- One slide answers one item of the course outline, and the item's number (1a,
  3b, ...) stands at its top left.
- Pictures use standard notation that a lecturer reads without a key: UML use
  case, component, deployment and sequence diagrams, an ER diagram, a DDD context
  map, a flowchart. Every box has its real name in words. No invented icons.
- The agents are shown as they really work: slide 2 is a real run of lumen,
  screenshotted every 3 seconds.
- Only flows are animated. A thing that moves is a word on a white tag.
- No text touches a line or a box edge. Check each picture zoomed, at several
  frames, before it goes into the deck.

The scenes are in `scenes_std*.py`; `make.py <scene>` draws one.

## The look (before the redesign)

Settled on 21 October 2026 from two reviews (`reviews/`), after a first dark
version drew everything as halftone dots and blurred every edge.

**Crisp, always.** Boxes have a 1.5 pt solid border in `#45484c`, radius 0.
Connectors are solid 1.5 pt lines with a 6 pt arrowhead. A queue is a crisp
rectangle of square cells. Chart bars are solid fills. All words are crisp.

**Icons, not boxes of words.** Every part is a line icon from `icons.py`
with one or two words under it: a person, a browser, a gateway, a database, a
gear for a worker, a key, a wallet. The work that moves is the business
object: a question bubble, a paper for a finding or an answer, a coin for
spend. A busy worker's gear turns. `python3 icons.py` draws them all into
`out/icons.png`. Settled on 21 October 2026, after the user found the boxes
of words hard to read at a glance.

**Everything moves.** Each icon has a small motion of its own: a gear turns, a
database band runs down, a stream's newest line is written, a page loads, a
coin spins. A lit icon moves twice as fast, and a lit connector flows. A
waiting worker's gear stands still, so a stop means something. A hold is drawn
frame by frame (`HOLD_FPS`), and `gifsicle` compresses each GIF to 32 greys.

**Halftone, rarely.** Only the agents (spheres, as on lumen's landing page) and
the title and end slides are halftone. At most one halftone group per slide:
the agents of one question count as one group.
No dot field inside a GIF.

**Colour.** Black page, white ink, `#9a9da3` secondary, `#7c8086` hints, rules
`#45484c` and `#36393d`, well `#1a1b1e`, raised `#2a2b2f`. No hue: red means
"waits on you" on the site, and nothing on a slide waits on the listener. The
accent is brightness: the active path and the moving work are pure white on a
dark-grey diagram. A result that matters is inverted, black on a white block,
once per step.

**States.** Acting now: white 2 pt border, raised fill, white label. Idle: grey
border, grey label. Waiting: the word "waiting" and a hollow job. Done: a check
mark. Failed: a crisp cross.

**Work.** A lead's job is a solid white square, a reader's job a solid white
circle, both about 14 pt. A job travels along a drawn connector, eased, 0.6 to
0.8 s per hop, at 25 frames a second. After each step the picture holds 2.5 to
3 s.

**Type.** Switzer. The GIF's step title is Medium 23 pt, top left; there is no
sub line under it. Box labels are 15 to 16 pt. Captions are 13 pt at least.
Numbers are 28 to 36 pt Semibold. Addresses and commands are JetBrains Mono.

**Layout.** At most six boxes and one counter on screen. Every part keeps one
place for the whole loop, and the flow runs left to right. A loop starts on
step 1 and ends on its last step.

## Rules for every slide

These come from the deck that worked: a small label, one short title, one
large animation, and the detail in the speaker notes.

1. **One idea per slide.** A title of at most eight words says the idea. The
   animation shows it. Nothing else is on the slide.
2. **The animation tells its own story.** A title line at the top of the GIF
   changes at each step: "1. You ask a question", "2. A lead agent splits it".
   It never repeats the slide's own title.
3. **Nothing jumps around.** Every part has one fixed place for the whole
   animation. Only small plain squares move. A square is a piece of work.
4. **Brightness means one thing.** White is the part that acts now and the
   work that moves. Grey is everything else.
5. **A number appears once, when it matters,** as a white block with black
   text, and it is a real measurement from `docs/platform/evidence/`. No
   number is invented.
6. **A new word is shown before it is used.** The first time the listener
   meets "worker" or "queue", it is a labelled box on the screen, not a word in
   a sentence. Internal names from the code (kernel, turn, intent, slice) never
   appear on a slide.
7. **No small print.** Nothing under 14 pt on a slide, nothing under 11 pt in a
   GIF. No paragraphs, no bullet walls. What the speaker says goes in the notes.
8. **Each GIF loops back to its first picture**, so it can stay on the screen
   while the speaker talks.

## What "AI slop" looks like, and what to do instead

| Slop | Instead |
|---|---|
| Ten bullets in 12 pt text | One title and one picture |
| "Robust, scalable, seamless" | A number from a real run: "1 to 4 workers in 50 s" |
| A term from the code, unexplained ("QueueWorker") | A box on the screen labelled "worker", shown first |
| A diagram with every box at once | The same diagram, built up one step at a time |
| The same point said three times | Said once, in the notes |
