# Visual review: landing, home, session

Method: Playwright screenshots of landing.html, home.html and session.html at 1440x900 and 390x844, in light and dark scheme. I also took 2x crops and scrolled every inner scroll region (the home main column on mobile, the session thread, and the mobile findings drawer). I judged only what is on screen.

Problems are ranked from worst to least bad.

## 1. Session, mobile 390, both themes: "Saved a file" row text collides

- **Where:** the thread, step "Saved a file". It is about 1 screen down from the top of the thread.
- **What:** the file name `code/popstack.py` and the count "28 lines" print on top of each other ("code/popstack28py lines").
- **Why:** overlapping text is the clearest sign of an unfinished build. It is also unreadable.
- **Fix:** use a two-line layout below 480 px: file name on line 1, "28 lines" in muted text on line 2. Alternatively, give the name `min-width: 0` with truncation and give the count `flex-shrink: 0`.

## 2. Session, mobile 390, both themes: code blocks run off the right edge

- **Where:** every "Ran" block (`$ python popstack.py ...`).
- **What:** the bordered box has no right border on screen. Its lines are cut mid-word ("distinct ima", "yes" becomes "y", "137901" is cut). Nothing shows that the block scrolls sideways.
- **Why:** the block looks broken. The cut columns are the result ("yes", "match", "no match"), so the user loses the most important data.
- **Fix:**
  - Keep the box inside the 350 px column.
  - Let only the inner `pre` scroll horizontally, and show a right-edge fade as a scroll hint.
  - Alternatively, reduce the code size to 11 px and wrap the output lines on mobile.

## 3. Session, mobile 390, both themes: the "Started 3 agents" table breaks apart

- **Where:** the thread, step "Started 3 agents".
- **What:**
  - The name column is about 100 px wide, so "compute-perm" and "compute-dyck" break at the hyphen onto two lines.
  - "Finished" drops to its own line under the description, with a blank line above it.
  - The three rows have three different heights.
- **Why:** a three-column table does not fit in 330 px. The result is a ragged staircase, not a table.
- **Fix:** stack each row on mobile:
  - Line 1: the agent name in medium weight, with the status at the right.
  - Line 2: the description in muted text.

  Never break an identifier at its hyphen (`white-space: nowrap`). Apply the same pattern to the "Searched" table.

## 4. Session, mobile 390: the chrome takes a third of the screen

- **Where:** the top and bottom of the viewport.
- **What:** the header uses three rows (logo + Findings + avatar, then breadcrumb, then Running + cost + Stop). Together they use 125 px. The composer uses about 75 px at the bottom. The thread gets about 630 of 844 px, and the sticky "lumen" label takes another 25 px of that.
- **Why:** the session page exists to read the thread. On a phone, the reader sees about 12 lines of content at a time.
- **Fix:**
  - Merge the breadcrumb and the status row into one line: "Pop-stack fertility · Running · $0.94", with Stop as an icon button.
  - Drop "Projects /" on mobile and make the back affordance an arrow.
  - Aim for a header of 88 px or less.

## 5. Landing, mobile 390, both themes: dead band between the sphere and the headline

- **Where:** from about y=270 to y=420.
- **What:** about 150 px of nothing sits between the bottom of the sphere and "Now you can do any frontier work." The headline then starts below the middle of the screen, and the input sits near the bottom edge.
- **Why:** the gap makes the sphere and the copy read as two unrelated pieces. It also pushes the only action (the input) to the bottom of the first screen.
- **Fix:** cut the gap to 32 to 48 px. As an option, shrink the sphere to about 160 px. The headline then starts near y=260, and the input sits in the middle of the screen.

## 6. Landing, desktop 1440, both themes: the sphere edge is jagged and the composition is unbalanced

- **Where:** the right half, the dot sphere.
- **What:**
  - The silhouette is a stepped grid, not a circle. The top and bottom rows are flat bars about 120 px wide, and the left and right sides show visible stair steps.
  - In light mode, the lit area at the upper left is so sparse that it reads as a bite out of the ball. The dense black lower right gives the ball a heavy, dirty look.
  - The ball (y=185 to 678) and the text block (y=255 to 650) sit at almost the same height, but the right edge has about 85 px of margin while the text has 40 px.
  - The bottom 200 px of the page is empty except for the footnote.
- **Why:** this is the hero image, and it is the first thing a visitor judges. Aliased edges read as low quality.
- **Fix:**
  - Mask the dot grid with an anti-aliased circle: scale the edge dots by their coverage of the circle, not on or off.
  - In light mode, reduce the maximum dot size in the shadow by about 20 %, and keep a minimum dot size in the highlight so the rim stays visible.
  - Align the right edge of the ball to the 40 px page margin, or center the ball in the right half on purpose.

## 7. All pages: the dark theme is a plain inversion with no real surfaces

- **Where:** home and session at 1440 dark.
- **What:**
  - The page is pure black. The right rail is a near-black grey, so the left/right split is almost invisible.
  - The primary submit button flips to solid white, and it becomes the brightest object on the screen. It is brighter than the headline and the content.
  - The "You" message box is a dark grey that is hard to see against black.
- **Why:** pure black with near-black panels gives no depth, and it flattens the region separation that the light theme gets from its grey rail. A white block that pulls the eye away from the content is a hierarchy error.
- **Fix:**
  - Use an off-black base (about #0B0B0C), and a rail and message surface one clear step lighter (about #161618).
  - Give the rail a hairline left border.
  - Make the dark-mode submit button a light grey (about #E6E6E6), or keep it outlined.

## 8. Session, desktop 1440: the header items do not share a baseline

- **Where:** the top bar, at the 2x crop.
- **What:**
  - The "lumen" wordmark sits about 3 px higher than "Projects / Pop-stack fertility".
  - On the right, "Running", "$0.94 spent" and "2 h 14 min elapsed" sit on one line, and "Stop" sits about 2 px lower.
  - The gaps are 16 px, 16 px and then 40 px before Stop.
- **Why:** small offsets like these make the bar look assembled by hand. The header repeats on every page, so it is in view all the time.
- **Fix:** align all header text to one baseline (use `items-baseline`, or one shared line-height). Use one gap token between status items. Separate Stop with a divider, not with extra space.

## 9. Session, desktop: the Stop control is too weak for what it does

- **Where:** the top right, "■ Stop".
- **What:** Stop is bold text with a small square glyph. It has no border and no fill. It looks the same as a label.
- **Why:** Stop ends a paid, running job. The user must find it immediately, and it must not look like status text next to "Running".
- **Fix:** make Stop an outlined button. It must be the same style as "New project" and "Findings", which are already outlined buttons elsewhere. As an option, use the danger colour on hover.

## 10. Home, desktop 1440, both themes: the findings rows have uneven rhythm, and "Dropped" is misaligned

- **Where:** the right panel, the last row of "Latest findings". The same problem shows in the session "Recorded 3 findings" list.
- **What:**
  - The "Dropped" badge (a dash glyph) sits about 4 px below the title baseline. The other badges line up with the title.
  - The gap from the title to the meta line in that row is about 3 px larger than in the other rows.
- **Why:** the dash glyph has different metrics from the square glyphs, so the row looks broken in a list that is otherwise strict.
- **Fix:** draw all four badge markers as 8 px boxes in one fixed-size inline slot (the dash as a 8x1.5 px bar centered in the slot). Align the badge to the title's first baseline.

## 11. All pages: there are too many ways to separate content in the session thread

- **Where:** session, the left column.
- **What:** one column uses six devices:
  - a grey fill (the "You" box),
  - a full-width hairline between turns,
  - a left vertical rule (lumen's steps),
  - an outlined box (code),
  - hairline row dividers (tables and findings),
  - a fade at the bottom above the composer.

  The step labels ("Thinking", "Ran", "Saved a file", "Recorded 2 findings") are 12 px bold. They are the same size as the meta text, so they do not work as headings.
- **Why:** each device says "this is a different kind of thing". With six devices, nothing stands out, and the column looks busy for content that is mostly plain text.
- **Fix:**
  - Keep the fill for the user message and the left rule for agent steps.
  - Replace the code box outline with a subtle fill (the same token as the "You" box).
  - Drop the hairline between turns, and use 32 px of space instead.
  - Make the step labels 12 px uppercase with letter-spacing, or 13 px medium in the foreground colour. They must read as labels, not as meta text.

## 12. All pages: type sizes for the same thing change from page to page

- **What:**
  - **Finding title:** home rail 14 px semibold, session rail 14 px semibold, session thread 15 px regular.
  - **Project title:** home list 16 px semibold. Session breadcrumb 14 px semibold.
  - **Status text:** status badges are 12 px ("Confirmed", "Open question"). Call-tree and project statuses are 14 px ("Finished", "Running").
  - **Answer text:** the final answer paragraphs are 16 px with a measure of about 620 px. "Thinking" text is 14 px muted with a measure of about 540 px. Tables run the full 783 px.
  - **Monospace:** 14 px in the finding body (`research/proof-sketch.md`), 13 px for the saved file name, 12 px in the code blocks and the Files list.

  The inline mono path looks heavier and larger than the sans text around it.
- **Why:** the same object at two sizes reads as two different objects. This weakens the claim that the three pages are one product.
- **Fix:** define one scale (12 / 14 / 16 / 18 / 24 and up) and map each object to one step:
  - A finding title is always 14 medium.
  - A status is always 12 with its marker.
  - Inline code is 0.9em of its parent.

  Keep the answer prose and the "Thinking" text on the same measure (about 640 px).

## 13. Session, both widths: status is drawn two ways for the same agents

- **Where:**
  - **Rail "Call tree" (desktop) and the drawer (mobile):** "● Finished" with a dot.
  - **Thread "Started 3 agents" table:** "Finished" as plain grey text with no dot.
- **Why:** the same agent and the same state are shown in two styles. The user cannot tell if they mean the same thing.
- **Fix:** use one status component everywhere: a marker plus a label, at one size.

## 14. Home, desktop 1440: the gutters are not even, and the bottom is empty

- **Where:** the left list and the right panel.
- **What:**
  - The left list has 40 px padding at the left and 24 px at the right, where it meets the grey panel. The right panel has 40 px on both sides.
  - The left column ends at y=790 and leaves about 110 px of white. The grey panel continues to the bottom, so the two halves end differently.
- **Why:** the uneven gutter makes the cost column look jammed against the panel edge.
- **Fix:** use 40 px on both sides of the left column. Let the list scroll inside a full-height column, or end both columns on the same line.

## 15. Home, desktop: the status column is too wide and too quiet; "Waiting on you" is the only colour

- **Where:** the left list, the first column.
- **What:**
  - The status column is 160 px wide for labels of about 60 px, which leaves a 90 px hole before every title.
  - "Waiting on you" is red, the colour of an error. It is the only colour on the whole page.
- **Why:** the hole breaks the scan from status to title. Red signals failure, but the row needs a decision, not a repair. The row also has no other emphasis, so a user in a hurry can miss the one project that needs them.
- **Fix:**
  - Reduce the column to about 120 px.
  - Use an amber or accent "attention" token for "Waiting on you", and also make the title row stronger: a left accent bar, or a light tinted row background.
  - Keep red for "failed".

## 16. Home, mobile 390: "New project" is in two places, and the form is at the bottom

- **Where:** the "New project" outlined button at the top right of "Projects", and the "New project" form under the seventh project (about 1 400 px down).
- **What:** the button and the form have the same name, but they are far apart. "Latest findings" is at the very bottom of the page, under the form.
- **Why:** on desktop the form is next to the list. On mobile it is hidden. The findings, which are the most interesting content, are the last thing on the page.
- **Fix:** make the mobile button open the form as a sheet, and remove the inline form on mobile. Put "Latest findings" above the projects, or behind a tab, as on the session page.

## 17. Session, mobile drawer: the drawer header does not match the rest

- **Where:** "Findings, call tree and files" with "Close".
- **What:** "Close" is 18 px plain text. All other secondary actions use outlined buttons ("Findings", "New project"). The title is a long label that repeats the three section headings below it.
- **Fix:** title the drawer "Details", or use the three section names as tabs. Make "Close" an icon button or the same outlined button.

## 18. Session, both widths: the sticky "lumen" label cuts the content under it

- **Where:** the top of the thread while scrolling (desktop y≈78, mobile y≈139).
- **What:** the label is sticky with no divider and no shadow. A line of the content under it shows half-cut directly below it (for example, the half row above "compute-dyck").
- **Fix:** add a 1 px bottom hairline or an 8 px fade under the sticky label. Alternatively, do not make the speaker label sticky.

## 19. Session, desktop: "28 lines" does not align with the right column edge

- **Where:** the "Saved a file" row.
- **What:** "28 lines" ends about 16 px left of the right edge that "Finished", "41 papers" and the badges use.
- **Fix:** align it to the same right edge.

## 20. Landing, both widths: small leftovers

- The footnote "lumen (lm), the SI unit of luminous flux." is 12 px and floats alone at the bottom left. It reads like debug text. Put it in a real footer row with Docs and Sign in, or remove it.
- At 390 px, the helper line "lumen picks its own question and reports back. You sign in first." wraps and leaves "in first." alone on line 2. Shorten the text, or use `text-wrap: balance`.
- The faint background dot grid shows behind the tabs, the input and the thread on all pages. On the landing page it supports the theme. On home and session it adds noise behind dense text. Keep it on the landing page only.
- On the landing page, the muted grey of "Just start." in dark mode is almost the same grey as the body copy. It reads as disabled text, not as an intentional second voice. Increase its contrast or use the foreground colour at 60 %.

## Verdict

I would not ship this yet. At desktop width, in light mode, the product looks calm, typographic and close to coherent. The three pages share a header, a composer, a status vocabulary and a rail, and the restraint is right for a research tool. But mobile is not finished. On the session page, text collides, code blocks run off the screen, tables break at hyphens and the chrome takes a third of the screen. On the landing page, a 150 px hole separates the hero image from the headline. The dark theme is an inversion, not a design. Across the pages, the same objects change size and style, and the small baseline and badge misalignments make the whole look less precise than the content it shows. Problems 1 to 7 block a release. Problems 8 to 15 are about one day of token and component cleanup. The rest is polish.
