# Visual review: landing.html, home.html, session.html

Method: Playwright screenshots at 1440x900 and 390x844, in light and dark color scheme. I zoomed to 2x crops where I needed detail, and I scrolled the inner scroll regions. I sampled some text colours from the pixels. I did not read the source.

Problems are ranked from worst to least bad.

---

## 1. Session, mobile 390, both themes: the "Recorded 2 findings" rows do not align

- **Where:** middle of the transcript, under "Recorded 2 findings" (about y = 455 to 495).
- **What is wrong:** the "Confirmed" row has its title directly after the badge, on the left. The "Open" row has its title "Induction on descents" pushed against the right edge. The two rows of one list use two different alignments.
- **Why it is wrong:** this reads as a broken layout, not a design choice. The eye cannot scan two rows that have no shared column. On desktop the titles share a column at x = 399, so the mobile version is a regression.
- **Fix:** at narrow widths, use one rule for every row: badge on the left, title left-aligned after a fixed gap (for example 8 px). Or stack the badge above the title, as the desktop sidebar does. Never let the title column float right.

## 2. Session, mobile 390, both themes: the command output wraps and loses its columns

- **Where:** the "Ran 2 min 41 s" code block (about y = 255 to 410).
- **What is wrong:** the lines wrap. `--tally-preimages` breaks to a new line, `images 2 min 41 s` breaks, and the two "yes" values fall onto lines of their own. The desktop block is a small aligned table. On mobile it is a ragged list.
- **Why it is wrong:** terminal output is tabular. When it wraps, the reader cannot match a value to its label. "yes" alone on a line has no meaning.
- **Fix:** do not wrap code blocks. Use horizontal scroll inside the block (`white-space: pre`, `overflow-x: auto`), and add a fade on the right edge so the user sees that more content exists. Optionally reduce the mono size to 12 px on mobile.

## 3. Landing and home, mobile 390, both themes: the header breaks into two rows, and every page has a different mobile header

- **Where:** top of the screen.
  - Landing: "lumen" is on row 1 at the top-left. "Docs" and "Sign in" are on row 2 at the right.
  - Home: "lumen" is on row 1. "$1.55 of $200 this month" and the "LZ" avatar are on row 2.
  - Session: "lumen", "Findings" and "LZ" fit on one row. The breadcrumb is on row 2 and the status is on row 3. The header is about 125 px high, which is 15% of the screen.
- **What is wrong:** on landing and home there is enough horizontal space for one row, but the items wrap. The wordmark sits about 6 px from the top edge, while on desktop it is centred in a 64 px bar. The three pages use three different mobile header structures.
- **Why it is wrong:** the header is the first thing the user sees, and the stair-step makes it look broken. Because the pattern changes per page, the product does not feel like one app on a phone.
- **Fix:** keep one row at 390 px on every page: wordmark on the left, actions on the right, vertically centred in a 56 px bar. On home, shorten the budget to "$1.55 / $200", or move it into the avatar menu. On session, put the status, cost and time on one compact line under the breadcrumb, or move them into the Findings sheet. The target is a header of no more than about 88 px.

## 4. All pages, all widths and themes: there is no single status language

- **Where:**
  - Home list: "Waiting on you" has a red dot and red text. "Running" has a grey dot and near-black text. "Finished" and "Stopped" are plain grey text with no dot.
  - Session header: "Running" has a grey dot.
  - Session transcript: "finished" is lower-case grey text.
  - Session call tree: "Running" and "Finished" are title case.
  - Session findings: "Open" is an outlined box, "Confirmed" is a filled box, and "Dropped" is a struck-through grey box.
- **What is wrong:** one product shows state in five visual styles and two letter cases. The grey dot for "Running" is the colour that the rest of the UI uses for inactive items, so an active task looks idle.
- **Why it is wrong:** status is the main thing a user checks on home and in session. When each surface uses its own style, the user must learn each one again, and the styles do not rank against each other.
- **Fix:** define one status component with three or four tones and use it everywhere. For example:
  - Attention (red dot): "Waiting on you".
  - Active (a dot in the foreground colour, or a pulsing dot): "Running".
  - Neutral (no dot, grey text): "Finished" and "Stopped".
  - Use one letter case everywhere (sentence case).
  - Keep the boxed badges for finding verdicts only. Then the two meanings (task state and finding verdict) look different on purpose.

## 5. Session, desktop 1440, both themes (worst in dark): the "Confirmed" badges dominate the Findings column

- **Where:** right sidebar, the badges above each finding (y = 150, 280, 410, 540, 690).
- **What is wrong:** "Confirmed" is a solid black box in light mode and a solid white box in dark mode. It is the highest-contrast object in the sidebar, louder than the finding titles and louder than the "Findings" heading. Each badge also sits on its own line, which adds about 28 px of height per card. At 2x zoom the label text nearly touches the box edge (about 2 px vertical padding).
- **Why it is wrong:** the content of a finding is its title. The badge is metadata. In dark mode, five white-filled or white-outlined rectangles make a strong vertical rhythm that pulls the eye away from the transcript.
- **Fix:**
  - Put the badge inline after the title, or in the right margin of the card, and remove its separate line.
  - Use a lower-contrast treatment for "Confirmed", for example a foreground-tinted fill at 10 to 15% with full-contrast text.
  - Give the badge at least 2 px x 6 px padding and a 1 to 2 px radius so it does not look cramped.
  - Use the same badge in the inline "Recorded 2 findings" table.

## 6. Session, all widths and themes: the transcript hierarchy is inverted and flat

- **Where:** the left column.
- **What is wrong:**
  - "You" messages are set at about 19 px in medium weight. lumen's final answers are about 16 px regular. The user's one-line prompt "Push it to n = 11 before you trust the conjecture." is the loudest text in the session, louder than the result it produced.
  - Every step label ("Thinking", "Searched", "Ran", "Started 3 agents", "Recorded 2 findings", "Saved a file") uses the same 12 px semibold grey. The steps form a long grey wall with no landmarks.
  - "Thinking" text and the final answer differ only in colour (grey compared to black). They do not differ in size, indent or rule.
- **Why it is wrong:** in a research tool, the agent's conclusion is the payload. The user already knows what they asked. When the labels are uniform, the user cannot scan for "where did it compute" compared to "where did it conclude".
- **Fix:**
  - Set user messages at body size (16 px) in medium weight, or set them in the body style with a subtle left rule.
  - Keep lumen's answer paragraphs as the largest body text.
  - Group the intermediate steps (thinking, tool calls) under one thin left rule or a 12 px indent, so the answer paragraphs stand out against the work.
  - Optionally give tool-call labels (Searched, Ran, Started) a small icon or the mono face, so they differ from "Thinking".

## 7. Session, desktop 1440, both themes: the column edges do not line up

- **Where:**
  - The composer ("Reply to lumen") and its helper text start at x = 40, in the speaker-label column. Every message body starts at x = 271.
  - The header status cluster ("Running $0.94 2 h 14 min") ends at x = 1169. This edge belongs to the home page content column. On session it aligns with nothing: the transcript ends at 939 and the sidebar starts at 963.
- **What is wrong:** on home the composer starts at x = 271, the same as the content. On session the same component starts at x = 40. The header carries a home-page grid into a page that has a different grid.
- **Why it is wrong:** the misaligned edges make the page look assembled, not designed. The composer at x = 40 also breaks the two-column "label | content" logic that the transcript sets up.
- **Fix:**
  - Start the composer and its helper at x = 271, so they align with the message bodies (as on home).
  - Move the status cluster in the session header so that it is right-aligned to the transcript edge (939), or put it in the sidebar header above "Findings".

## 8. Home, desktop 1440, both themes: the content is weighted left and the bottom third is empty

- **Where:**
  - The content column runs from x = 271 to 1169. The band from 1169 to 1440 (271 px) is empty, but the header items extend to 1400.
  - Below the last project (y = 600), the remaining 300 px are empty.
- **What is wrong:** the page has a 230 px label column on the left and an equal dead band on the right, so it looks off-centre against a full-width header. "$1.55 of $200 this month" ends at 1344 and the avatar ends at 1400. Neither aligns with the content edge at 1169.
- **Why it is wrong:** the header and the body use two different grids. With only four projects, the large empty lower area makes the page feel unfinished.
- **Fix:**
  - Choose one grid. Either centre a max-width container (for example 1120 px) and put the header inside the same container, or extend the content to the header's right margin.
  - Align the budget's right edge with the right edge of the cost column.
  - For short lists, accept the empty space but anchor it: for example, a quiet footer or a "Finished projects" archive link under the list.

## 9. Landing, desktop and mobile: the illustration is drawn differently in light and dark, and the light version is heavy and faceted

- **Where:** the halftone sphere (desktop right half, mobile top 45%).
- **What is wrong:**
  - Light mode has a ground shadow ellipse. Dark mode has none.
  - In light mode the sphere is a mass of large black dots. Its silhouette is drawn by a rim of large dots, even on the lit left side, so the outline reads as a jagged polygon with flat facets at the top and on the sides. At 2x zoom the top is a flat row of dots.
  - The shadow ellipse is wider than the sphere and is off-centre to the right. It spans about x = 775 to 1385 while the sphere spans 790 to 1290, so it ends 15 px from the page margin.
  - In dark mode the sphere fades out at the right edge and looks smaller and lighter.
- **Why it is wrong:** the two themes show two different objects. In light mode the heaviest thing on the page is a dark ball, which works against the name "lumen" (a unit of light) and outweighs the headline. The off-centre shadow looks like a mistake.
- **Fix:**
  - Use one illustration and invert only the ink, so both themes show the same light and the same silhouette.
  - Remove the dark rim on the lit side. Let the dot size go to near zero at the highlight and at the lit edge.
  - Centre the shadow under the sphere and limit its width to about 1.1x the sphere diameter, or remove the shadow in both themes.
  - Raise the dot density, or anti-alias the silhouette, so that the facets disappear.

## 10. Landing, desktop 1440 and mobile 390, both themes: the composition stops halfway down

- **Where:**
  - Desktop: between the helper line "lumen picks its own question and reports back." (y = 640) and the footnote "lumen (lm), the SI unit of luminous flux." (y = 868) there is a 220 px empty band.
  - Mobile: the sphere uses the top 45% of the screen, so the composer starts at y = 675, close to the bottom.
- **What is wrong:** on desktop the footnote floats alone in the corner at the same tiny size as the helper text, so it looks like a leftover. On mobile the decoration has more space than the one action on the page.
- **Why it is wrong:** the primary action of the landing page is the composer. On a phone the user should see it without the illustration pushing it to the fold.
- **Fix:**
  - Desktop: centre the hero block and the sphere vertically in the space between header and footer, or let the footnote join a real footer row together with "Docs" and "Sign in".
  - Mobile: reduce the sphere to about 160 to 200 px, or place it behind the headline at low opacity, so the composer sits in the upper 60% of the screen.

## 11. All pages, desktop, both themes (worst in dark): the heaviest line on screen is the header rule

- **Where:** the line under the header at y = 64 on home and session. Landing has no header rule.
- **What is wrong:** the header rule is full contrast (black on white, white on black). The section dividers on home (y = 256) and the row dividers are light grey. In dark mode the header rule is a bright white line across the whole width.
- **Why it is wrong:** a decorative separator should not be stronger than the content separators. The bright line in dark mode is the first thing the eye lands on. Also, landing has no rule, so the shell looks different between the pages.
- **Fix:** use the same border token for the header rule as for the section dividers, or a token one step stronger, never full foreground. Decide whether the landing header also gets the rule, and apply that decision to all three pages.

## 12. All pages, all themes: one grey does every secondary job

- **Where:** the placeholder "Name a field of mathematics, or leave it open", the helper text, "Finished", "Stopped", "2 h ago", the "Thinking" body text, and the Findings descriptions. All sample to the same colour (about #5E6166 in light, #8D9096 in dark).
- **What is wrong:** a placeholder, a timestamp, a status, and a paragraph of reasoning all look the same. The contrast is adequate (about 6:1), but there is no hierarchy among secondary items.
- **Why it is wrong:** the placeholder looks like entered text of the same weight as real content. The user also cannot tell metadata from secondary prose.
- **Fix:** add one more step: a lighter tertiary grey for placeholders, timestamps and helper lines (still at least 4.5:1). Keep the current grey for secondary prose such as "Thinking" and descriptions.

## 13. Home and session, desktop: the counts sit in different places

- **Where:** home "Projects 4": the count is inline, directly after the label. Session "Findings 5" and "Files 7": the count is right-aligned at the far edge of the sidebar.
- **What is wrong:** the same pattern (a section label with a count) uses two layouts.
- **Why it is wrong:** this is a small inconsistency, but it adds to the feeling that each page was built on its own.
- **Fix:** pick one layout. Inline after the label is better here, because the sidebar's right edge already holds the badges and the statuses.

## 14. Session, desktop 1440: the inline step tables have too much empty space; on mobile they change shape

- **Where:** the "Searched" and "Started 3 agents" tables in the transcript.
- **What is wrong:** on desktop the key column (arXiv, OEIS, reader) is at x = 271, the query is at x = 399, and the result is right-aligned at x = 939. Short rows such as "OEIS | pop-stack preimages | nothing" leave a 400 px gap in the middle. On mobile the source jumps above the query and looks like a row heading.
- **Why it is wrong:** the eye must travel across the empty space to connect a query with its result. The bold "pop-stack preimages … nothing" row loses its emphasis across the gap.
- **Fix:** let the result column follow the query column (left-aligned at a fixed column, for example x = 700), or limit the table width to about 560 px. On mobile keep the source inline as a small prefix ("OEIS · A262494 …").

## 15. Session, desktop 1440: the sidebar fade hides "Call tree" and "Files"

- **Where:** the bottom of the right sidebar (y = 840 to 900).
- **What is wrong:** on load, "Call tree" and its subtitle sit under a fade at the bottom edge. Its content and the whole "Files" section are below the fold of the sidebar's own scroll area. Nothing tells the user that the sidebar scrolls independently.
- **Why it is wrong:** the call tree shows whether the agents are alive. That is status information, and the design hides it below a long Findings list.
- **Fix:** collapse the Findings to the newest three with a "Show all 5" link, or make the three sections tabs or collapsible groups. Then all three section headings are visible without scrolling.

## 16. Landing only, all themes: the dot-grid background is only on landing

- **Where:** a faint dot grid behind the whole landing page (visible in 2x crops around the header and the composer).
- **What is wrong:** home and session have flat backgrounds. Behind the composer the grid shows through at the edges.
- **Why it is wrong:** this is a minor inconsistency, but it makes the composer look different on landing than on home, although it is the same component.
- **Fix:** either keep the grid only behind the illustration area, or remove it. Give the composer an opaque surface so the grid never shows through it.

## 17. Home, desktop and mobile: the first row mixes three text styles

- **Where:** "Inversion sequences avoiding 021": the description begins with "Asks to extend the count to n = 14, about $2.40." in near-black semibold, then continues in grey regular.
- **What is wrong:** this row alone has three weights and two colours in its description. On mobile the bold part wraps over two lines and becomes the heaviest block on the screen after the titles.
- **Why it is wrong:** the intent (show the pending request) is good, but the red status already signals "this needs you". Two emphasis devices on one row compete with each other.
- **Fix:** keep the request sentence in the foreground colour at regular weight, or make it the only line, with the grey context hidden. Let the red status carry the urgency.

## 18. Composer, all pages: "Attach" has no affordance, and the send button is a box inside a box

- **Where:** the right end of every composer.
- **What is wrong:** "Attach" is grey text with no icon and no border, so it looks like a label, not a button. The send button is a solid square inset 4 px inside the 1 px bordered field, which forms a square-in-square that is slightly off the visual weight of the field border.
- **Why it is wrong:** these are small issues, but the composer is the one control that appears on all three pages.
- **Fix:** give "Attach" a paperclip icon and a hover surface. Either make the send button flush with the field's right edge at the full field height, or give the field a radius that matches the inset.

---

## Verdict

I would not ship this as it is. On desktop the three pages share a strict and calm visual system: one typeface, one composer, one header, sharp corners and a monochrome palette. That shared system is a sound base. Below it, the pages do not agree with each other. Status uses five styles. The column edges and the header grid change from page to page. The session transcript gives more weight to the user's prompt than to the agent's result, and the light and dark landing pages show two different illustrations. On a phone the product looks broken: two pages have stair-stepped headers, and the session page has a misaligned findings list and wrapped terminal output. Fix items 1 to 3 before any release, because they look like bugs. Items 4 to 7 decide whether the product reads as one coherent tool. Do them in the same pass, because they come down to one status component and one grid. The remaining items are polish that can follow.
