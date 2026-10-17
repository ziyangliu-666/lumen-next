# Visual review: landing, home, session

Method: Playwright headless Chromium, 1440x900 and 390x844, light and dark color scheme. I took full-viewport shots at 0.8 s and 5-6 s after load, 2x crops of details, scrolled the session log and the rail, opened the second composer tab on the landing page, and opened "Details" on the 390 session page. I judged only what is on screen.

Coordinates are CSS pixels from the top-left of the viewport.

Problems are ranked from worst to least bad.

---

## 1. One status glyph means four different things

- **Page:** all three. **Theme/width:** all.
- **Where:** home rows (status after the title); session top bar ("Finished"); session rail, Call tree ("done") and Findings ("Confirmed"); session log, Record and Delegated tables ("done", "confirmed").
- **What is wrong:** the solid square marks "Stopped" on home. It also marks "Finished", "done" and "Confirmed" on session. "Waiting on you" is the same square in red. "Running" is a half-filled square, "Open" is a hollow square, and "Dropped" is a box with a bar through it. At 10 px these glyphs are hard to tell apart. "Stopped" (a failure or halt) and "Confirmed" (a success) look identical.
- **Why it is wrong:** status is the main thing a user scans for on home and in the rail. When one shape means both "halted" and "succeeded", the user must read the label every time, and the glyph adds nothing.
- **Fix:** define one status set and use it everywhere. For example: solid = done/confirmed, hollow = open, half = running, red solid = needs you, and a distinct mark for stopped/dropped (a dash or an "x"). Put the set in one component and use it on home rows, in the session top bar, in the rail and in the log tables.

## 2. Session: the newest reply is a ghost on load

- **Page:** session. **Theme/width:** both, most visible in light at 1440.
- **Where:** the last "Reply" block, y = 500-630, x = 271-939.
- **What is wrong:** at 0.8 s after load, the reply and its "Reply" label are at roughly 10 % opacity in light mode and about 50 % in dark mode. They need several seconds to reach full contrast. The page opens scrolled to this block, so it is the first thing the user should read, and it is the faintest text on the screen.
- **Why it is wrong:** the reply is the answer to the user's question. A slow reveal on the main content reads as a loading fault, not as polish. The light and dark themes also reveal at different visible speeds.
- **Fix:** show the existing reply at full opacity on load. Keep a short reveal (150-200 ms) only for content that arrives live while the user watches.

## 3. Session 390: content is clipped in three places

- **Page:** session. **Theme/width:** both, 390.
- **Where and what:**
  - The Run code block (y ~ 690-720 in the log) clips horizontally: "--tally-prei" is cut at the right edge with no visible scroll cue. The output lines are cut the same way.
  - Below the title rule (y = 148-162) a grey sliver of a code block sticks out under the sticky header. In the dark theme the scrolled log shows a half line of "code/popstack.py +28" cut by the composer rule.
  - The composer placeholder "try the induction, and tell me if it stalls" wraps onto two lines at 19 px. The "+" and the send button then centre on a two-line block, so the row looks heavy and lopsided.
- **Why it is wrong:** clipped monospace text hides the exact numbers the product exists to show. Hard cuts with no fade at the sticky edges look like render bugs.
- **Fix:** make code blocks scroll horizontally with a visible right-edge fade, or wrap long lines at 390. Add a 16-24 px fade at the top and bottom edges of the scrolling log. Use 16 px for the composer text at 390 (home already does this) and keep the placeholder to one line.

## 4. Landing light: the hero image is broken at the edge and differs from dark

- **Page:** landing. **Theme/width:** light, 1440 and 390.
- **Where:** the cast shadow under the sphere, y = 640-735, x = 760 to the right edge.
- **What is wrong:**
  - The shadow ellipse runs off the right edge of the viewport and is cut straight. As the light source animates, the shadow moves further right and is cut harder (seen with the second tab active). At 390 it is also cut at the right edge.
  - The shadow uses a dot grid with a different pitch and phase from the sphere. At the contact line the dots of the two grids interleave and form moire noise.
  - Dark mode has no cast shadow at all. The two themes show two different objects: a black ball on a floor in light, a glowing ball floating in space in dark.
- **Why it is wrong:** the sphere is the only image in the product, and the first thing a visitor sees. A cut edge and grid noise at its base look accidental.
- **Fix:** clamp the shadow inside the right column, with at least 40 px margin from the viewport edge. Render the shadow on the same dot grid as the sphere. Decide whether the shadow exists, and then show it (or remove it) in both themes.

## 5. Header items sit on a grid line that only the session page uses

- **Page:** all three. **Theme/width:** both, 1440.
- **Where:** top bar, x = 1078. Landing puts "Docs" there. Home puts "$0.71 of $200" there. On session, x = 1078 is the left edge of the rail, and nothing in the top bar sits there.
- **What is wrong:** on landing and home, the item at x = 1078 aligns with nothing visible on that page. "Docs" floats 250 px away from "Sign in", so the nav reads as two unrelated items. The three top bars also differ: landing has no header rule, home and session have one. Home shows the budget; session drops it.
- **Why it is wrong:** the header is the one element that should be identical on every page. Here it changes layout per page and looks unaligned on two of three.
- **Fix:** use one header. Logo left. On the right, one group with a fixed 24 px gap: budget (signed-in pages), then the avatar; "Docs" and "Sign in" as one group on landing. Show the budget on session too. Use the rule on all pages or on none.

## 6. Two identical black squares compete for "primary action"

- **Page:** home and session. **Theme/width:** both, both widths.
- **Where:** the "LZ" avatar (x = 1368-1400, y = 20-52) and the composer send button (home x = 1014-1054, y = 172-212; session x = 899-939, y = 823-863). At 390 the avatar and the send button are both 32-40 px solid squares on the right edge.
- **What is wrong:** the avatar has the same fill, size and shape as the only primary button. In dark mode both are white squares.
- **Why it is wrong:** the solid square is the product's sign for "act here". Using it for an identity badge dilutes the one call to action on the page.
- **Fix:** render the avatar as an outlined circle, or as a text-only initial with a muted border. Keep the solid square for submit only.

## 7. Session 1440: rule weights and double rules break the structure

- **Page:** session. **Theme/width:** both, 1440.
- **Where and what:**
  - At y = 144 one horizontal line changes weight: 1 px under the log (x = 40-939), 2 px over the rail (x = 1078-1400). It reads as two lines that missed each other.
  - The composer has a full-width rule above it (y = 805, x = 40-939) and a second underline below the input (y = 875, x = 271-939). Two parallel lines 70 px apart frame an empty strip.
  - The scrolling log runs under the y = 144 rule with a hard cut: half a line of text or the top of a code block shows.
- **Why it is wrong:** this page relies on rules alone to separate regions. When rule weight is random, the hierarchy of regions is lost.
- **Fix:** use one weight for region rules (1 px, foreground) and one for item rules (1 px, border colour). Make the y = 144 line one weight across both columns. Keep only the input underline in the composer and drop the rule above it, or the reverse. Fade the log at its top edge.

## 8. Session: the user's message looks like the agent's reply

- **Page:** session. **Theme/width:** both, both widths.
- **Where:** "You" rows (for example "Push it to n = 11 before you trust the conjecture.") and "Reply" rows.
- **What is wrong:** both are 19 px in the foreground colour. "You" is medium weight, "Reply" is regular. The side labels "You" and "Reply" have the same style. The only difference is a small weight change. At 390 the reply is 19 px for 9-15 lines, which makes it the heaviest block on the phone screen.
- **Why it is wrong:** in a log of an agent's work, who said what is the first question. The user's instruction should be instantly findable when scrolling back.
- **Fix:** give "You" rows one clear marker: a left bar, a tinted surface, or a different label colour. Set the reply at 17 px on 390 and 18 px on 1440, with the line length kept at 65-75 characters.

## 9. Home 1440: three different right edges

- **Page:** home. **Theme/width:** both, 1440.
- **Where:** the composer ends at x = 1054. Project descriptions wrap at about x = 1000. Cost and time align right at x = 1400. Row dividers run to x = 1400.
- **What is wrong:** the content column has no single right edge. Each row has a 350-400 px empty gap between the description and the cost, so the cost reads as belonging to the page edge, not to the row.
- **Why it is wrong:** the reader must jump across a void to connect "$0.41 / 41 min ago" with "Pop-stack fertility". The composer looks like it stopped short by accident.
- **Fix:** pick one content width (for example x = 271-1054) for the composer, the rows and the dividers. Put cost and time inside that width, right-aligned. Or keep the full width and extend the composer to x = 1400.

## 10. Landing 1440: the composition is bottom-heavy and the top-left is dead

- **Page:** landing. **Theme/width:** both, 1440.
- **Where:** left column, y = 70-480, empty. The headline starts at y = 480, the composer ends at y = 795. The sphere occupies y = 145-680 on the right.
- **What is wrong:** the left half has 410 px of nothing above the headline, while the right half is full from y = 145. The two columns do not share a top or a centre line. The headline baseline does not align with the sphere's centre or base.
- **Why it is wrong:** the eye lands on the sphere, then must drop to the bottom-left corner to find the message and the only input. The empty quadrant reads as a missing element.
- **Fix:** align the text block to the sphere: put the headline's top at the sphere's top (y ~ 145), or centre the text block on the sphere's vertical centre (y ~ 410). Keep the composer in the first 700 px.

## 11. Landing 390: dead gap, off-centre sphere, wrapped placeholder

- **Page:** landing. **Theme/width:** both, 390.
- **Where and what:**
  - y = 420-525: 105-130 px of empty space between the sphere (or its shadow) and the headline.
  - The sphere spans x = 80-360, so its centre is at x = 220, 25 px right of the screen centre (195).
  - The placeholder "Name a field, or leave it open." wraps to two lines at 19 px. Home at the same width shows the same text on one line at 16 px.
- **Why it is wrong:** an off-centre hero on a narrow, symmetric screen looks like a layout bug. The gap pushes the composer to y = 700-770, close to the bottom.
- **Fix:** centre the sphere. Cut the gap to 40-48 px. Use the 16 px composer size from home.

## 12. Inconsistent casing and micro-table styles

- **Page:** session (and home). **Theme/width:** all.
- **Where:** "Finished" and "Confirmed" are capitalised (top bar, rail). "done", "confirmed" and "open" are lower case (Call tree, log tables). In the log, the Delegated table shows bold names ("reader", "compute-perm"); the Record table shows grey "finding"; the Save table shows grey "file" and mono path.
- **What is wrong:** the same status words change case between the log and the rail. The three small tables use three different first-column styles.
- **Why it is wrong:** small inconsistencies stack up and make the page look assembled from parts.
- **Fix:** use sentence case for all status labels. Use one table row style: muted first column, foreground second column, status right.

## 13. The background texture exists only on the landing page

- **Page:** landing vs home and session. **Theme/width:** both, both widths.
- **Where:** the whole background. Landing has a faint dot grid; home and session are flat white or black.
- **What is wrong:** the step from landing to home loses the only texture, and the header changes at the same time (see 5). The two pages look like two products.
- **Why it is wrong:** the dot motif is the brand idea (the sphere is made of it). It vanishes after sign-in.
- **Fix:** either keep the faint grid on all pages, or carry the dot motif into the app in one small place (empty states, the logo, the status glyphs). Do not drop it at the sign-in line.

## 14. Text breaks badly at 390

- **Page:** home and session. **Theme/width:** both, 390.
- **Where and what:**
  - Home: "for 3-" / "stack-sortable" breaks at the hyphen. "is wrong...." shows four dots (full stop plus ellipsis).
  - Session reply: "past k" / "= 3", "to" / "n = 10.", "single-" / "descent".
- **Why it is wrong:** math expressions that split across lines are hard to read, and the four dots look like a typo.
- **Fix:** use non-breaking spaces inside "n = 10", "k = 3" and similar terms, and a non-breaking hyphen in "3-stack". Strip the final full stop before adding the ellipsis.

## 15. Session 390 "Details" sheet has no header and a tiny close target

- **Page:** session. **Theme/width:** light (also dark), 390.
- **Where:** top of the sheet. "Close" sits at x = 333-370, y = 28-40, as small bold underlined text pressed onto the rule at y = 44.
- **What is wrong:** the sheet has no title. The close control is about 37 x 14 px. It is the only underlined bold text style in the product. "Details", which opens it, uses a different underline style in the top bar.
- **Why it is wrong:** a 14 px tall target is below a usable touch size (44 px). Without a title the user does not know where they are after opening it.
- **Fix:** give the sheet a 56 px header with a title ("Details") on the left and a 44 x 44 close button on the right, using the same icon button style as the composer.

## 16. Composer tabs: weak active state and an odd size jump

- **Page:** landing and home. **Theme/width:** all.
- **Where:** "Free exploration / A starting point" above the composer.
- **What is wrong:** the active tab differs from the inactive one only by text colour (black vs grey). There is no underline or other marker. The tabs are 13-14 px; the input text below is 19 px. The tabs look like captions, not controls.
- **Why it is wrong:** the user must guess that these are switchable modes, and which one is on.
- **Fix:** add a 2 px underline or a filled pill to the active tab. Raise the tabs to 15 px so that they read as controls.

## 17. Low-priority density and ordering issues

- **Home 1440, both themes:** the lower third (y = 600-900) is empty with three projects. Not wrong in itself, but with the wide gaps in item 9 the page feels unfinished. Fix: tighten the column (item 9). The empty space then reads as intentional.
- **Session rail, both themes:** "Dropped" is the first finding, with strikethrough and muted text, so the top of the Findings list is the least useful item. Fix: sort confirmed and open first, and move dropped items to the end or collapse them.
- **Landing, both themes:** the footnote "lumen (lm), the SI unit of luminous flux." at y = 867 is about 11 px and muted. It is near the limit of legibility. Fix: 12-13 px, or remove it.
- **Home vs session, data:** home shows "Pop-stack fertility, Running, $0.41". The session for the same project shows "Finished, $0.94", while the last reply says "I am writing that up now". A reviewer moving between the pages sees two different states for one project. Fix: use one fixture for both pages before any review or demo.

---

## Verdict

I would not ship this yet. The visual language is a strong base: one typeface, a strict black-and-white palette, a label column and rules instead of boxes, and a memorable halftone sphere. But the system is not yet applied with discipline, and the faults sit where users look first. The status glyphs contradict each other. The newest reply opens as a ghost. The hero image is cut at the viewport edge in light mode. The header changes from page to page and aligns to a grid line that only one page uses. On the phone, code and the composer clip and wrap. Items 1 to 8 are each a day of work or less, and together they decide whether this looks like one product or three mock-ups. Fix those, then ship. Items 9 to 17 can follow in the next pass.
