# The presentation deck

The deck for the ASS presentation on 26 October 2026. The pictures do the
explaining; the words on a slide only name what the picture shows.

```sh
python3 docs/platform/slides/gifs.py          # draw every GIF into out/
node docs/platform/slides/build.js            # write out/Team15-Lumen-Platform.pptx
```

`build.js` needs `pptxgenjs` (`npm install --prefix docs/platform/slides`).
`gifs.py` needs Pillow and NumPy.

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
4. **Colour means one thing.** Red is the part that acts now. Blue is work on
   its way in. Black is work that is done. Grey is everything else.
5. **A number appears once, when it matters,** as a red badge, and it is a
   real measurement from `docs/platform/evidence/`. No number is invented.
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
