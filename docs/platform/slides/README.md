# The presentation deck

The deck for the ASS presentation on 26 October 2026. The pictures do the
explaining; the words on a slide only name what the picture shows.

```sh
python3 docs/platform/slides/gifs.py          # draw every GIF into out/
node docs/platform/slides/build.js            # write out/Team15-Lumen-Platform.pptx
```

`build.js` needs `pptxgenjs` (`npm install --prefix docs/platform/slides`).
`gifs.py` needs Pillow and NumPy.

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

## The look: Lumen's own

The deck is drawn the way the web app is drawn (`apps/web/src/styles/theme.css`,
`apps/web/src/ui/space.ts`, `apps/web/src/pages/landing/Intro.tsx`), in its dark
theme:

- **Black ground, white ink.** `#000000` and `#ffffff`. Secondary text is
  `#9a9da3`. Rules are `#45484c`. Nothing else, except one red.
- **Red means "waits on you", and nothing else.** `#ff3b30`. The deck has no
  red at all, because nothing on it waits on the listener.
- **Every picture is halftone dots on one fixed grid.** A shape is painted
  first and then printed as white dots: a dot is as large as the paint is
  strong. Agents are spheres, as on the landing page. What acts now is
  printed bright; what waits is printed dim. Moving work prints as it crosses
  the grid, the way the site's stars do.
- **A faint dot field behind everything**, fading from the middle out, as
  behind the intro.
- **Type is Switzer** for everything, medium weight and tight for titles, and
  JetBrains Mono for anything typed. Labels are crisp text over the dots,
  never dots themselves.
- **Zero radius, no shadows, thin grey borders.** A number that matters is
  inverted: black text on a white block, like the site's "Sign up".
- **Progress is a row of thin segments**, as at the bottom of the intro.

## Rules for every slide

These come from the deck that worked: a small label, one short title, one
large animation, and the detail in the speaker notes.

1. **One idea per slide.** A title of at most eight words says the idea. The
   animation shows it. Nothing else is on the slide.
2. **The animation tells its own story.** A title line at the top of the GIF
   changes at each step: "1. You ask a question", "2. A lead agent splits it".
   The listener can follow it without the speaker.
3. **Nothing jumps around.** Every part has one fixed place for the whole
   animation. Only small plain squares move. A square is a piece of work.
4. **Brightness means one thing.** Bright dots are the part that acts now.
   Dim dots are everything else. Work that moves is a small bright block.
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
