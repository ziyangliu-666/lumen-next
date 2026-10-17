# Visual review: landing, home, session

I judged only the rendered screens. The captures are 1440x900 and 390x844, in light and dark, with scrolled states and 2x crops. The problems are ranked from worst to least bad.

## 1. The key result of a run is cut off on mobile

- **Page:** session. **Theme:** both. **Width:** 390.
- **Where:** the "Ran" code block in the middle of the transcript.
- **What is wrong:** the output lines overflow the box on the right. "distinct im…" is cut mid-word, and the "yes" column is clipped to "y". Nothing shows that the box can scroll sideways. The block also loses its right padding, so text runs into the border.
- **Why it matters:** the "yes" values are the result. A reader sees a broken box and does not see the answer.
- **Fix:** wrap the output with `white-space: pre-wrap` and a hanging indent, or reflow it as a two-column key/value list at narrow widths. If it must scroll, keep the right padding and add a right-edge fade so the overflow is visible.

## 2. Content is sliced at the edges of the scroll areas

- **Page:** session. **Theme:** both. **Width:** 1440 and 390.
- **Where, three places:**
  - At 1440, the transcript opens on the label "lumen" followed by "checked to n = 8. I have it to n = 10.". This is the tail of a sentence, 14 px under the header rule.
  - At 390, a sliver of descenders from a clipped line shows just under the header rule.
  - At 1440, the last row of the Files panel ("research/literature.md") is cut horizontally through the glyphs at the bottom of the viewport. The panel scrolls only about 12 px.
- **Why it matters:** sliced text reads as a rendering bug. It is also the first thing a user sees on the most important screen.
- **Fix:**
  - Anchor the initial scroll to the start of a turn, not to an arbitrary pixel offset.
  - Give the top of the transcript a real fade mask, at least 32 px, that fully hides partial lines.
  - Add bottom padding to the right panel so that the last row ends above the fold or clearly scrolls. If the content almost fits, make it fit.

## 3. A dot-grid texture sits behind all reading content, and it reacts to the pointer

- **Page:** all three, worst on home and session. **Theme:** dark is worst, light is faint. **Width:** both.
- **Where:** the white or black base surface behind project rows, transcript text, the code block, and tables. The grey side panels have no texture. Near the pointer, the grid darkens into a soft band. In captures this band shows up as a dotted smudge between blocks, for example above "New project" on mobile home and under the "Searched" table on desktop session.
- **Why it matters:** on the landing hero, the halftone is the brand. On a dense reading surface it is noise under 14 px grey text and monospace output, so contrast and legibility drop. The pointer bands look like stray separators, and they compete with the real hairline rules.
- **Fix:** keep the texture on the landing page only, or behind empty areas only. Remove it from list, transcript, and panel surfaces, and drop the pointer reaction there.

## 4. "Stop" is the loudest control on the session page

- **Page:** session. **Theme:** both. **Width:** 1440 (header right) and 390 (third header row).
- **What is wrong:** "Stop" is the only bordered, button-shaped element in the desktop header, and it is wide (about 104 px). On mobile it is the largest control in the header, larger than "Findings". The destructive action gets the strongest visual weight, and the status and cost beside it read as secondary.
- **Why it matters:** the eye lands on the action that ends a 2-hour run. Users hit what looks most clickable.
- **Fix:** make "Stop" a compact ghost or text button with a stop icon, the same height as the status text, and add a confirmation. Let the status ("Running", cost, elapsed time) carry the header.

## 5. The mobile session header uses three rows

- **Page:** session. **Theme:** both. **Width:** 390.
- **What is wrong:** the logo row with "Findings" and the avatar, the breadcrumb row, and the status row with "Stop" take about 125 px. The composer takes about 75 px at the bottom. The transcript keeps roughly three quarters of the screen, and two outlined buttons of different widths stack on the right.
- **Why it matters:** this is the reading screen. The chrome is heavy and the right edge looks unbalanced.
- **Fix:**
  - Drop the logo wordmark on this page at mobile width.
  - Put "Pop-stack fertility" on row one with a back chevron.
  - Put status, cost, a "Findings" icon button and a "Stop" icon button on row two.
  - Target 88 px or less in total.

## 6. Status uses five visual forms for one concept

- **Page:** all. **Theme:** both. **Width:** both.
- **The five forms:**
  - Home project rows: a dot plus a label in a left column. Red for "Waiting on you", a filled grey dot for "Finished", a hollow dot for "Stopped", and an arc spinner for "Running".
  - Findings, on home and session: a square plus 12 px text at the right. A filled square for "Confirmed", a hollow square for "Open question", a dash for "Dropped".
  - The session call tree: a dot plus 14 px text at the right.
  - The session "Started 3 agents" table: plain grey text, no marker.
  - The session header: a spinner plus 14 px text.
- **Two more defects:** the same agent states appear twice on the session page, in the transcript table and in the call tree, in two different styles. The "Running" spinner is an 8 px arc that reads as a letter "u" ("u Running") at both densities.
- **Why it matters:** one meaning should have one look. Here a user must learn each panel's code separately.
- **Fix:**
  - Define one status token: marker, size, text size, and text colour.
  - Use one marker family for run state (dots) and a different one for finding state (squares), and use each everywhere.
  - Draw the spinner at 12 px with a visible track, so that it reads as motion and not as a glyph.

## 7. The session transcript has several line lengths and loose tables

- **Page:** session. **Theme:** both. **Width:** 1440.
- **What is wrong:**
  - Different blocks wrap at different widths. The "You" box spans the full 783 px column. Thinking text wraps at about 560 px. The final lumen paragraph wraps at about 620 px. The tables and the code block span the full width.
  - In the "Searched" and "Started 3 agents" tables, the result column ("41 papers", "Finished") is pushed to the far right, 300 px or more away from the query it belongs to.
  - The transcript groups content in three ways: a hairline between turns, a grey fill for the user turn, and a left rule for lumen's steps. The final lumen paragraph is outside the left rule and has no separator, so it looks like it belongs to no turn.
- **Why it matters:** the column has a ragged right edge, and the tables are hard to scan across.
- **Fix:**
  - Set one reading measure, about 640 px, for all prose and the user box.
  - Let only the code block and the tables go wider, or cap the whole column at 720 px.
  - Give the tables fixed column widths so that the result sits near the query.
  - Keep the final answer inside the lumen turn: either extend the rule, or end the rule above the answer and give the answer a small "Answer" label.

## 8. The landing hero sphere differs between themes and sits off the grid

- **Page:** landing. **Theme:** both. **Width:** 1440 and 390.
- **What is wrong:**
  - In light mode, the sphere is a heavy black mass. Large dots fill the shadow side, and it outweighs the headline.
  - In dark mode, the shadow side dissolves to almost nothing on the right, so the sphere reads as a lopsided glow, not a ball. The two themes show two different objects.
  - At 1x, the silhouette is visibly stair-stepped.
  - The right edge of the sphere is about 1355 px, while the nav ends at 1400 px. The sphere does not align to the page margin.
  - The 260 px gap between the form (ends at 593 px) and the sphere is empty.
  - At 390, the gap between the sphere and the headline (about 130 px) is larger than the gap between the header and the sphere. The sphere floats, detached from both.
- **Fix:**
  - Tune the dot-size curve per theme so that both read as the same lit sphere at similar visual weight. In light mode, cap the maximum dot size. In dark mode, keep a minimum rim.
  - Align the sphere's right edge to the 40 px page margin, or centre it in the right half.
  - At 390, cut the gap under the sphere to about 40 px, or let the sphere sit behind the headline at low contrast.

## 9. The composer placeholder wraps on mobile

- **Page:** landing and home. **Theme:** both. **Width:** 390.
- **What is wrong:** "Name an area of mathematics, or leave it open" wraps to two lines. The input grows to about 72 px, compared with 50 px on desktop, and the black send block becomes a tall slab. On the landing page, the helper line also wraps and leaves an orphan, "in first.".
- **Fix:** use a shorter placeholder at narrow widths ("Name an area, or leave it open") and keep the input at one line. Shorten the helper line, or allow it to wrap without an orphan.

## 10. The header and money format change from page to page

- **Page:** all. **Theme:** both. **Width:** both.
- **What is wrong:**
  - The landing header has no bottom rule. Home and session have one.
  - Home shows "**$2.02** of $200 this month", with only the number bold. Session shows "**$0.94 spent**", fully bold. Home on mobile drops "this month" and leaves "$2.02 of $200", which has no time unit.
  - The session wordmark sits about 2 to 3 px above the baseline of the breadcrumb beside it. "Running" sits about 1 px below "$0.94 spent".
- **Fix:**
  - Use one money pattern everywhere: a bold figure followed by a regular-weight unit, for example "$0.94 spent" and "$2.02 of $200 this month". Keep the time unit on mobile ("$2.02 / $200 mo").
  - Baseline-align all header text.
  - Decide whether the marketing header has a rule and make that intentional.

## 11. The type scale has too many steps

- **Page:** all. **Theme:** both. **Width:** both.
- **What is wrong:**
  - I count at least eight text sizes in the app pages: about 12, 13, 14, 15, 16, 17 and 18 px, plus mono at 12 and 13 px.
  - Weights mix regular, medium and semibold without a clear rule. Finding titles are semibold in the side panel but regular in the transcript "Recorded 2 findings" list.
  - The step labels ("Thinking", "Ran", "Searched", "Recorded 2 findings") are 12 px semibold. They are smaller than the grey 14 px body they label, so they read as footnotes and not as headings.
  - Body text is 14 px on home and 16 px in the session transcript.
- **Fix:**
  - Collapse to about five sizes (12, 14, 16, 18, display) and two weights.
  - Set the step labels at 13 or 14 px medium.
  - Render a finding title the same way wherever it appears.

## 12. The logo mark is a blurry blob at 1x

- **Page:** all. **Theme:** both. **Width:** both.
- **What is wrong:** the 16 px mark beside "lumen" is a square-pixel dither. At 1x it renders as a grey smudge. It does not match the round-dot halftone of the hero, so the mark and the key visual look like two systems.
- **Fix:** redraw the mark as a small grid of round dots on whole pixels, from the same family as the hero sphere, and test it at 16 px and 1x.

## 13. Finding badges give the weaker state the stronger ink

- **Page:** home and session. **Theme:** both. **Width:** both.
- **What is wrong:** "Open question" has black text and a hollow square. "Confirmed" has grey text and a filled grey square. The fill says "strong", and the text colour says "weak". The two cues contradict each other.
- **Fix:** pick one channel. Either use the same text colour for all badges and let the marker carry the state, or make the marker fill and the text weight agree.

## 14. The "Dropped" row is misaligned

- **Page:** home. **Theme:** both. **Width:** 1440 (Latest findings) and 390.
- **What is wrong:** the "Dropped" badge sits about 5 px lower than the title baseline. The meta line under that title has about 3 px more gap than the other rows. Every other row aligns its badge with its title.
- **Fix:** give the dash marker the same box as the square markers, and align it to the first-line baseline.

## 15. Small alignment slips on home

- **Page:** home. **Theme:** both. **Width:** 1440.
- **What is wrong:** the status labels in the left column ("Waiting on you" and the others) are 14 px text. The project titles beside them are 16 px semibold and top-aligned, so the two baselines differ by about 2 px on every row.
- **Fix:** align the status text to the first-line baseline of the title.

## 16. The landing footnote floats

- **Page:** landing. **Theme:** both. **Width:** 1440 and 390.
- **What is wrong:** "lumen (lm), the SI unit of luminous flux." is set in 12 px grey text at the bottom-left, with no relation to anything else. At 390 it sits about 50 px under the form helper text, so it reads as part of the form.
- **Fix:** move it into a proper footer row with Docs and legal links, or put it next to the wordmark as a tooltip. At 390, give it clear separation from the form.

## Verdict

I would not ship this as it is. The base is coherent: one neutral palette, one accent colour, consistent 40 px margins, and the same composer on landing and home. All three pages read as one product. But the most important screen, session, shows broken edges on first view: a sentence fragment at the top, a sliced file row at the bottom, and on mobile a code block whose result is cut off. The dot-grid texture under the reading surfaces and the oversized "Stop" button also undercut a design whose whole idea is calm clarity. Fix items 1 to 5. They are each a small, contained change. Then the pages are shippable. Items 6 to 11 are the pass that turns "consistent enough" into "designed", and they should follow in the next iteration.
