# Visual review: landing, home, session

Method: Playwright screenshots of `landing.html`, `home.html` and `session.html` at 1440x900 and 390x844, light and dark. I also took 2x crops, scrolled the inner scroll regions, opened the mobile "Findings and files" drawer and switched the landing tab. I judged only what was on screen.

Problems are ranked from worst to least bad.

---

## 1. The Files list in the session rail shows a clipped, half-faded row that looks broken

- **Page / theme / width:** session, light and dark, 1440. The same defect shows in the 390 drawer.
- **Where:** right rail, Files section, about y = 830 to 860 at 1440. In the 390 drawer it is at the top and bottom of the Files list.
- **What is wrong:** a fade band sits about 40 px above the real bottom of the rail. `code/popstack.py` is grey. Only the lower half of `code/stacksort.py` shows, so it reads as struck through. The row below it, `research/literature.md`, is back at full contrast. In the 390 drawer, `research/proof-sketch.md` is faded and the last visible row is cut in half.
- **Why it is wrong:** a "more below" fade must sit at the edge of the visible area. In the middle of a list it looks like a rendering bug, and it makes one file look deleted or disabled. This is the first defect a careful user sees on the most information-dense page.
- **Fix:** anchor the fade to the bottom edge of the scroll viewport. Make it no taller than about 24 px, and do not let any row render below it. Show the fade only while there is content below. Remove it when the list fits, which is the case here with 7 files at 1440.

## 2. On mobile home, the project that needs the user is below the fold, and its status is moved under the text

- **Page / theme / width:** home, light and dark, 390.
- **Where:** the whole first screen, and then the first project row.
- **What is wrong:** the first screen shows "New project" and "Latest findings". Projects starts at y ≈ 670. The red "Waiting on you" label is at y ≈ 815, the last line of the viewport. In each mobile row the status also moves from the left column to below the description, so it becomes the third item in the row.
- **Why it is wrong:** on desktop the layout says that the project list is the main content and "Waiting on you" is the most urgent signal. Mobile reverses that order. The one thing that needs a decision from the user is the hardest thing to find.
- **Fix:** on 390, put Projects first. Put the status line directly above or beside the title, for example "● Waiting on you · $0.18 · 2 h ago". Move the composer and Latest findings below Projects, or collapse them behind a "New project" button.

## 3. The home desktop screen is half empty, and the grey panel makes that emptier

- **Page / theme / width:** home, light and dark, 1440.
- **Where:** the left column below y ≈ 500, and the right panel below y ≈ 580.
- **What is wrong:** the content ends at about 55 to 65 percent of the viewport height. The grey right panel continues to the bottom with nothing in it, so the empty area becomes a large flat block.
- **Why it is wrong:** the page looks unfinished, as if data failed to load. The full-height panel makes the left/right split the strongest shape on the page, which is stronger than the content.
- **Fix:** do not make the panel full height. Let the right column end with its content, or give it a top-aligned card with its own boundary. Alternatively, use the space for something real, for example older findings or a spend history. Then vertical emptiness at the bottom is normal page end, not a void inside a filled box.

## 4. Badges and buttons share one look, and there are three badge styles

- **Page / theme / width:** home and session, all themes and widths.
- **Where:** "Open question" (black 1 px outline), "Confirmed" (grey fill, no border), "Dropped" (grey outline, grey text, session log). Also the "Stop" button in the session header and the "LZ" avatar.
- **What is wrong:**
  - "Stop" is an 11 to 12 px outlined rectangle. It looks the same as the "Open question" badge.
  - The "LZ" avatar is also a square outlined box, so it reads as a button or a checkbox.
  - "Open question" has a black outline, so it is louder than "Confirmed", which is the stronger result.
  - The badge text sits almost on the border, with about 1 to 2 px vertical padding.
- **Why it is wrong:** users cannot tell what is clickable and what is a label. The only destructive control on the session page has the least visual weight in the header. The emphasis on findings is the reverse of their value.
- **Fix:**
  - Define one badge component with one shape and the same padding (for example 2 px 6 px, 12 px text), and change only the tone. Give "Confirmed" the strongest tone, "Open question" a neutral one, and "Dropped" a muted one.
  - Make "Stop" a real button with button height (28 to 32 px), button padding, and a clear destructive tone.
  - Make the avatar a circle, or a filled tile, so that it does not look like a control or a badge.

## 5. Mobile session wraps terminal output and breaks its columns

- **Page / theme / width:** session, light and dark, 390.
- **Where:** the "Ran 2 min 41 s" code block, y ≈ 295 to 430.
- **What is wrong:** "8,152,860 distinct / images 2 min 41 s" breaks across two lines. "yes" falls onto its own line twice.
- **Why it is wrong:** the output is a table, and wrapping removes its alignment. The reader cannot see which "yes" goes with which check. This is evidence the product wants the user to trust.
- **Fix:** set `white-space: pre` with horizontal scroll inside the code block. Add a right-edge fade to show that it scrolls. As an alternative, reduce the mono size to 11 px on narrow screens so that 44 to 48 columns fit.

## 6. The mobile session header uses three rows and a two-line button

- **Page / theme / width:** session, light and dark, 390.
- **Where:** top 130 px.
- **What is wrong:** row 1 has the logo, a large outlined "Findings and / files" button that wraps to two lines, and the avatar. Row 2 has the breadcrumb. Row 3 has the status, cost, time and Stop. With the composer at the bottom, about 620 px are left for the conversation.
- **Why it is wrong:** the wrapped button is the biggest element in the header, larger than the logo and the project name. A wrapped button label looks like a layout failure.
- **Fix:** shorten the label to "Findings" or use an icon button with a count ("Findings 5"). Put the breadcrumb and the status on one line, or drop "Projects /" on mobile and show only the project name with a back chevron. The target is a header of two rows at most, about 88 px.

## 7. The type hierarchy is inverted, and there is too much 12 px grey text

- **Page / theme / width:** all pages, all themes and widths.
- **Where:**
  - Section headings: "Projects 4", "New project", "Latest findings", "Findings", "Call tree", "Files", "Thinking", "Ran", "Recorded 2 findings".
  - Helper and meta lines: "lumen picks its own question…", "Pop-stack fertility, 4 min ago", "What lumen has checked, newest first.", "lumen keeps working while you write…", the landing footnote.
- **What is wrong:**
  - The section headings are about 14 px semibold. The row titles under them are about 16 px semibold. A section heading is smaller than its own items.
  - In the session log, "Thinking" and "Ran" labels are about 12 px bold, which is smaller than the 14 px body text they introduce.
  - Many lines are 12 px in mid grey, which is close to the minimum readable size and contrast, especially in dark mode.
- **Why it is wrong:** the eye cannot find the structure of the page from the headings. Everything reads as one flat list of medium-weight lines. Small grey text in many places makes the UI look timid, and it is hard to read at 1x on a normal display.
- **Fix:** use a small, explicit scale and apply it on all three pages:
  - Section heading: 13 px uppercase tracking, or 18 px semibold. In either case it must be clearly different from a row title.
  - Row title: 15 or 16 px semibold.
  - Body: 14 px.
  - Meta: 13 px.

  Keep 12 px only for badges. Raise the meta grey by one step in both themes.

## 8. The session header status cluster floats with no anchor

- **Page / theme / width:** session, light and dark, 1440.
- **Where:** "● Running $0.94 for 2 h 14 min [Stop]", which starts at x ≈ 870.
- **What is wrong:** the cluster is aligned to the left edge of the rail below it. It is not aligned to the breadcrumb or to the avatar. There are about 220 px of empty space between Stop and LZ.
- **Why it is wrong:** the cluster looks dropped in place. On home, the same header slot shows the monthly budget against the right edge, so the two app headers do not match.
- **Fix:** right-align the run status next to the avatar, in the same slot that home uses for the budget. Alternatively, move it into the left group after the project name ("Pop-stack fertility · ● Running · $0.94 · 2 h 14 min"). Keep one header pattern on both app pages.

## 9. The session log and rail clip content under the header

- **Page / theme / width:** session, light and dark, 1440 and 390.
- **Where:** directly below the header bar, at y ≈ 64 to 85.
- **What is wrong:**
  - The log opens scrolled to the bottom. A sticky "lumen" speaker label sits at y = 78 in light grey. The same label further down, at y = 360, is black. The two look like different states.
  - When the rail scrolls, "Findings 5" and its subtitle slide under the header and are cut through the middle. There is no top fade or edge to hide them.
- **Why it is wrong:** text cut by a hard edge looks broken. A grey speaker label looks disabled. Together they make the top of the conversation look unstable.
- **Fix:** give sticky speaker labels the same colour as normal labels and a solid background strip. Add a short top fade to the rail scroll area, or make the rail section headings sticky with a background so that they replace each other cleanly.

## 10. The landing sphere is visibly pixelated, and its light and dark versions differ

- **Page / theme / width:** landing, light and dark, 1440 and 390.
- **Where:** the halftone sphere, right half at 1440, top at 390.
- **What is wrong:**
  - The outline is a stair-step of full-size dots. The top and bottom edges are flat rows, and the left side bulges at about two thirds of the height. It reads as a rough circle, not a sphere.
  - In light mode, the floor shadow touches and overlaps the bottom of the ball.
  - In dark mode there is no shadow at all, so the two themes show different objects.
  - In light mode the dense black right half is the heaviest mass on the screen. It outweighs the headline and pulls the eye away from the input.
- **Why it is wrong:** the sphere is the only brand image, and the crude rim is visible at normal size. The theme mismatch looks like an omission, not a choice.
- **Fix:** make the dots shrink toward the rim, as the dark version already partly does, so that the silhouette becomes smooth. Leave a clear gap of 16 to 24 px between the ball and the shadow. Either draw a lit shadow or glow in dark mode, or remove the shadow in both themes. In light mode, cap the maximum dot size or lighten the shadow side so that the sphere does not outweigh the headline.

## 11. The landing layout has dead zones and an orphan footnote

- **Page / theme / width:** landing, light and dark, 1440 and 390.
- **Where:**
  - At 1440, the 260 px gap between the text column (ends at x ≈ 593) and the sphere (starts at x ≈ 855).
  - At 1440, the footnote "lumen (lm), the SI unit of luminous flux." at y = 868.
  - At 390, the 140 px gap between the sphere (ends at y ≈ 300) and the headline (y ≈ 440).
- **What is wrong:**
  - At 1440, the two halves do not relate to each other. The text column is narrow, and the sphere sits against the right margin.
  - The footnote is 12 px grey, alone at the bottom-left, and looks like debug text.
  - At 390, the helper line (y ≈ 763) and the footnote (y ≈ 819) have almost the same style and sit close together, so they read as one paragraph.
- **Fix:**
  - At 1440, move the sphere toward the centre, or widen the text column to about 600 to 640 px and reduce the gutter.
  - At 390, close the gap to about 32 to 48 px. You can also make the sphere smaller so that the input rises.
  - Either give the footnote a real footer with a divider and the Docs and Sign in links, or remove it.

## 12. The rows on home do not share a baseline

- **Page / theme / width:** home, light and dark, 1440.
- **Where:** each project row: status label (x = 40), title (x = 200), cost and "Updated" (right).
- **What is wrong:** the 14 px status label is top-aligned with the 16 px title, so its baseline sits about 3 to 4 px lower than the title baseline. The right column has two lines (cost, then time). The time line is not aligned to the first or the second line of the description.
- **Why it is wrong:** a three-column row reads as a table, so a ragged baseline is easy to see. It makes the list look unpolished.
- **Fix:** align all columns on the first baseline. Put the cost and the time on one line ("$0.18 · 2 h ago") so that the right column does not compete with the description.

## 13. The page gutters are inconsistent

- **Page / theme / width:** home and session, light and dark, 1440.
- **Where:** the left column and the right panel.
- **What is wrong:** the left content starts 40 px from the window edge. The right panel content starts 24 px from the panel edge. The left list and the session log end 24 px before the panel, so the content almost touches the grey edge.
- **Why it is wrong:** the two columns have different inner margins, and the left content looks pushed against the divider. This is the reason the split looks slightly cramped although the page is mostly empty.
- **Fix:** use one gutter of 40 px on every side of every region, including both sides of the panel boundary.

## 14. "Waiting on you" has no action

- **Page / theme / width:** home, light and dark, 1440 and 390.
- **Where:** the first project row.
- **What is wrong:** the only sign that the user must act is red text. There is no button such as "Approve $2.40" or "Review", and the row has no other emphasis.
- **Why it is wrong:** this is the most important item on the page, but it has the same visual weight as the three other rows.
- **Fix:** add an inline primary action in the row, or a slim highlighted band (a tinted background or a left accent bar). Repeat the action on mobile.

## 15. Dark mode separates regions too weakly

- **Page / theme / width:** home and session, dark, 1440.
- **Where:** the boundary between the black main area and the #111-like right panel. Also the "You" message box.
- **What is wrong:** the panel tone is only slightly lighter than the page. Only the header rule is clearly visible. The black input field inside the grey panel looks like a hole.
- **Why it is wrong:** the two-region structure, which light mode shows clearly, almost disappears in dark mode.
- **Fix:** lift the panel one more step (for example #161616 to #1a1a1a), or add a 1 px left border to the panel. Give inputs the panel tone plus a border instead of pure black.

## 16. The link and label styles are inconsistent

- **Page / theme / width:** session, all themes and widths.
- **Where and what:**
  - "Show all 5" is the only underlined link in the product. The breadcrumb "Projects", the file names and the finding titles are links or look clickable, but have no underline and no other mark.
  - File names are 12 px mono grey on grey, so they look like disabled items, not like links.
  - "Saved a file / file   code/popstack.py   28 lines" has a key column that only says "file". This creates a wide empty gap and repeats the label above it.
- **Fix:** choose one link treatment and use it everywhere, for example no underline at rest and an underline on hover, plus a consistent hover background for clickable rows. Give file names the normal text colour. In the "Saved a file" row, drop the "file" key cell.

## 17. The dot-grid background reads as dirt

- **Page / theme / width:** landing, home left column, session log, light and dark, 1440.
- **What is wrong:** a very faint dotted grid covers the white and black areas. It stops at the grey panels and the message boxes. At 1x it looks like screen noise, not a texture. It also shows through the indented Thinking blocks.
- **Fix:** remove the grid inside the app pages and keep it only on landing, where it supports the halftone idea. Or make it strong enough to look intentional and apply it to every surface.

## 18. Small issues

- **Mobile drawer header (session, 390):** the drawer title "Findings and files" and the first section heading "Findings" are the same size and weight, one below the other. Make the drawer title larger, or drop the section heading for the first section.
- **Call tree (session rail):** child rows are indented only 16 px and have no connector line, so "lead" and its agents read as a flat list. Increase the indent or draw a tree line.
- **Thinking text (session log, 1440):** the paragraph about n = 11 ends a line with a lone "I". Set a max line length of about 70 characters on log text, or balance the wrap.
- **Header style (landing vs app):** landing has no header rule. Home and session have one. This is acceptable, but make the logo size and weight the same, and use the same right-side spacing for the links and the avatar.

---

## Verdict

I would not ship this yet. The direction is coherent: there is one composer, one palette, one grid and a clear monochrome identity, and all three pages read as the same product. But the execution has visible defects that a first-time user will notice in seconds:

- the broken fade in the Files list;
- text clipped under the header;
- terminal output wrapped on mobile;
- a two-line header button on mobile.

The structural problems are more serious. On mobile home, the item that needs the user's decision is hidden below the fold. Badges, the Stop button and the avatar look the same. The headings are smaller than the content they head, so the hierarchy is flat. Desktop home is half empty under a full-height grey panel.

None of this needs a redesign. Items 1 to 9 are about a day of focused work:

- a type scale;
- one badge component and one button component;
- one gutter value;
- correct scroll masks;
- a mobile reorder.

After those fixes, the product would look deliberate instead of almost finished.
