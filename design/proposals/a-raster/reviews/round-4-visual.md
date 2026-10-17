# Visual review: landing, home, session

Method: Playwright screenshots at 1440x900 and 390x844, light and dark colour scheme, with 2x crops of details. I also clicked the tabs, "New project" (home, mobile), "Findings and files" (session, mobile) and "Show all 5" (session, desktop). Only what is on screen is judged.

Problems are ranked from worst to least bad.

---

## 1. Home, mobile: the composer and "Latest findings" are trapped in a 48 px strip

- **Page / theme / width:** home, light and dark, 390.
- **Where:** directly under the header, the grey band with the text "New project".
- **What is wrong:** The band is about 48 px tall. It starts at x = 64, not at the 20 px page margin, so it looks like a misplaced tab. The composer ("Free exploration / From a starting point", input, send button) and the full "Latest findings" list are inside it, clipped. Tapping "New project" does nothing visible. On a phone, the user cannot start a project and cannot see findings.
- **Why it is wrong:** The page's main action is invisible. The band also breaks the left margin that every other element on the page uses.
- **Fix:** Remove the fixed height. Render the "New project" section at full height above "Projects", aligned to the 20 px margin, then "Latest findings" below the project list. If space is a concern, collapse only the findings list behind a "Show findings" disclosure, never the composer.

## 2. Session, mobile: the command output is cut off with no scroll cue

- **Page / theme / width:** session, light and dark, 390.
- **Where:** the "Ran 2 min 41 s" block in the middle of the log.
- **What is wrong:** The lines "--tally-preimage…" and "8,152,860 distinct…" stop at the box edge. The "yes" column and the "2 min 41 s" value are not visible at all. Nothing shows that the box scrolls sideways.
- **Why it is wrong:** The hidden part is the result. A reader sees a truncated command and no answer.
- **Fix:** Wrap output lines at mobile width (`white-space: pre-wrap`), or keep horizontal scroll and add a right-edge fade plus a visible scrollbar. Reduce the inner padding from about 16 px to 12 px on mobile.

## 3. Status badges: three visual languages for one concept, and one looks like a focus ring

- **Page / theme / width:** home and session, both themes, both widths.
- **Where:** right side of each finding row (home "Latest findings", session "Findings" rail, session "Recorded 2 findings").
- **What is wrong:** "Confirmed" is a filled grey chip. "Open question" is a 1 px dashed outline. "Dropped" (visible after "Show all 5") is plain grey text with a struck-through title. The dashed outline reads as a keyboard focus ring or a drop target, most of all in dark mode, where it is a bright white dashed box on near-black.
- **Why it is wrong:** The eye goes to the dashed boxes first, so the open questions look selected or broken. Three treatments for one attribute make the user learn three rules.
- **Fix:** Use one chip shape for all states. Change only fill and text colour: for example, solid neutral fill for "Confirmed", a tinted or outlined (solid 1 px, not dashed) chip for "Open question", a muted chip for "Dropped". Keep the strikethrough off the title, or keep it and drop the chip, not both.

## 4. Home, desktop: half the screen is empty, and the two columns end at different heights

- **Page / theme / width:** home, light and dark, 1440.
- **Where:** the left column below the fourth project (y ≈ 460 to 900) and the right panel below the last finding (y ≈ 580 to 900).
- **What is wrong:** About 50 % of the left column and 35 % of the right panel are blank. The content block looks pinned to the top, with no bottom anchor. The grey right panel runs to the bottom edge, which emphasises the emptiness.
- **Why it is wrong:** The page looks unfinished, as if data failed to load. It also gives no hierarchy: nothing on the page is larger than 16 px, so there is no focal point to balance the void.
- **Fix:** Give the page a real heading ("Projects", 24 to 28 px, in the weight used for the session title), and move "New project" to the top of the left column or into the header as a primary button. Cap the content height to its own size and let the grey panel end with it, or put the findings list under the projects in one column with a max width of about 760 px.

## 5. Section headings change style from page to page

- **Page / theme / width:** home and session, both themes, 1440.
- **Where:** "Projects 4", "New project", "Latest findings" on home; "Findings 5", "Call tree", "Files 7" on session.
- **What is wrong:** On home, section headings are grey, regular, 14 px. On session, they are near-black, semibold, 14 px, with a 12 px grey subtitle ("What lumen has checked, newest first."). "Latest findings" on home and "Findings" on session are the same object with different headings and different row anatomy (home rows show project and time; session rows show a body sentence).
- **Why it is wrong:** The two pages look like two products. The grey home headings also sit at almost the same visual weight as the meta text under each row, so the sections do not separate.
- **Fix:** Pick one section heading style (semibold, primary colour, count in muted colour) and use it on both pages. Use one finding row component in both places, with the body line optional.

## 6. Session: the speakers are hard to tell apart

- **Page / theme / width:** session, both themes, both widths.
- **Where:** the log, at "You" and "lumen" labels.
- **What is wrong:** The speaker labels are 12 px grey. The user message is 16 px medium; lumen prose is 16 px regular. Everything else (colour, indent, background) is the same. The only grouping device is a thin rule above each turn and a 1 px left line on lumen's tool block.
- **Why it is wrong:** In a long log, the user cannot find their own instructions fast. The 12 px labels are the smallest text in the column but carry the most structural meaning.
- **Fix:** Give user turns a container: a subtle surface fill or a left bar in the primary colour, with the label at 13 to 14 px medium. Keep lumen turns on the page background. Do not rely on weight alone.

## 7. Session, mobile: the header eats the top of the log and clips a label

- **Page / theme / width:** session, light and dark, 390.
- **Where:** the top 113 px (logo, "Findings and files", avatar, title, status line) and the first line under it.
- **What is wrong:** The header has three rows. When the log is at its default (bottom) position, the "You" label sits half under the header rule and is faded, so a ghost label shows at y ≈ 120. The breadcrumb "Projects /" from desktop is gone, so there is no visible way back except the logo. "Findings and files" is plain text with no button shape.
- **Why it is wrong:** The clipped label looks like a rendering error. The missing back path is a navigation gap. Unstyled text next to a boxed avatar does not read as a control.
- **Fix:** Merge title and status into one row ("Pop-stack fertility · Running · $0.94"), add a back chevron before the title, and give "Findings and files" a button or icon-button style. Add a top fade to the log scroller, the same as the bottom fade on desktop, instead of a hard cut under the rule.

## 8. Session, mobile drawer: the fade sits on the wrong end of the file list

- **Page / theme / width:** session, "Findings and files" drawer, both themes, 390.
- **Where:** "Files 7", first entry "research/proof-sketch.md".
- **What is wrong:** The first file name is faded to almost invisible. The lines below it are full contrast and the list is cut at the screen bottom without a fade.
- **Why it is wrong:** The first file looks disabled. The scroll cue points the wrong way.
- **Fix:** Put the "more below" fade on the bottom edge of the scroller, not on the first row under the heading.

## 9. Pointer halo draws dots over text

- **Page / theme / width:** session (seen), home (seen on mobile tap), light, 1440 and 390.
- **Where:** after a click near the rail edge, a halo of grid dots appears in the log column at x ≈ 720 to 845, over the words "approval. I" in the Thinking block. On home mobile, a tap makes a dot field appear behind and across the header and the "Projects" heading.
- **What is wrong:** The interactive background grid is drawn above, or through, reading text.
- **Why it is wrong:** Dots on top of letters reduce legibility and look like noise or a rendering bug on a work screen.
- **Fix:** Keep the reactive grid on the landing page only. On home and session, keep the static grid at most, below all content and masked out of text columns, or remove it.

## 10. Landing, desktop: the hero block floats in a large empty frame

- **Page / theme / width:** landing, light and dark, 1440.
- **Where:** about 220 px of empty space between the top nav and the headline, about 220 px between the helper text and the footer line, and about 260 px between the composer's right edge (x = 593) and the sphere (x ≈ 855).
- **What is wrong:** The text column is 553 px wide at the left. The sphere is at the far right. The middle is a dead gap. The footer line "lumen (lm), the SI unit of luminous flux." is 12 px grey at the very bottom and reads as forgotten text.
- **Why it is wrong:** The two halves do not relate, so the composition looks like two pieces placed side by side. The footer pun is too weak to be decoration and too odd to be legal text.
- **Fix:** Move the sphere left so its left edge sits about 80 to 120 px from the text column, or enlarge it to fill the right half. Put the footer line on the same baseline grid as the nav, or remove it.

## 11. Landing: the light and dark spheres are different objects

- **Page / theme / width:** landing, both widths.
- **Where:** the halftone sphere.
- **What is wrong:** In light mode, the sphere has a wide dotted floor shadow under it. That shadow is wider than the sphere and extends further to the right (to x ≈ 1385 at 1440, close to the right margin). In dark mode, the shadow is absent. In light mode, the right edge of the sphere also shows a straight vertical column of dots between y ≈ 380 and 470, so the silhouette looks flat on that side.
- **Why it is wrong:** The hero image should be the same in both themes. The asymmetric shadow breaks the right margin and makes the light version look heavier at the bottom.
- **Fix:** Show the shadow in both themes or in neither. Centre it under the sphere and keep it inside the 40 px margin. Check the dot sampling at the sphere's right limb.

## 12. Landing, mobile: the sphere pushes the action to the bottom

- **Page / theme / width:** landing, both themes, 390.
- **Where:** the sphere occupies y ≈ 85 to 355; the headline starts at y ≈ 415; the composer sits at y ≈ 674 to 748.
- **What is wrong:** The decorative image takes the most valuable 40 % of the first screen. The placeholder "Name a field of mathematics, or leave it open" wraps to two lines, so the input grows to about 74 px and the "Attach" label disappears (icon only).
- **Why it is wrong:** The main action is the last thing on screen. A two-line placeholder in a single-line field looks broken.
- **Fix:** Reduce the sphere to about 160 px and put it behind or beside the headline, or move it under the composer. Shorten the mobile placeholder ("Name a field, or leave it open").

## 13. Home, desktop: project rows have weak internal alignment

- **Page / theme / width:** home, both themes, 1440.
- **Where:** each project row in the left column.
- **What is wrong:**
  - The status label ("Waiting on you", "Running") follows the title at a variable x, so the statuses form a ragged line.
  - The status text is 14 px next to a 16 px title and is centred, not baseline-aligned, so it sits about 2 px low.
  - Status colours are mixed: red text for "Waiting on you", black for "Running", grey for "Finished" and "Stopped". "Running" in black has the same weight as the title.
  - In row 1 the summary starts in primary colour ("Asks to spend about $2.40…") and switches to grey mid-sentence. The other rows are all grey.
  - Summary text wraps at x ≈ 615 while the meta column starts at about x = 700, which leaves an unused 85 px band.
- **Why it is wrong:** The list is hard to scan by status, which is the main reason to look at it.
- **Fix:** Put status on its own column or at a fixed position (for example, a chip above the title or a fixed column left of cost). Baseline-align title and status. Use one muted colour for terminal states and one accent for "Running". Keep the "needs you" sentence in a separate line with an action, not as a colour change mid-paragraph.

## 14. Session, desktop header: the status group floats

- **Page / theme / width:** session, both themes, 1440.
- **Where:** "● Running  $0.94  for 2 h 14 min" at x ≈ 870 in the header.
- **What is wrong:** The group sits at the left edge of the rail column, far from both the breadcrumb and the avatar. "for 2 h 14 min" is about 1 px higher than "Running" and "$0.94". There is no stop or pause control next to "Running".
- **Why it is wrong:** The status reads as a fragment, not as part of the page title. A running agent with cost and time but no stop control looks incomplete.
- **Fix:** Move the status next to the project title in the breadcrumb row, or right-align it next to the avatar. Baseline-align the three items. Add a "Stop" button at the same place.

## 15. Type scale: too many small sizes, too few large ones

- **Page / theme / width:** all pages, both themes, both widths.
- **Where:** composer helper text, section subtitles, finding meta, speaker labels, footer line (all about 12 px); badges (about 12 px); row titles (14 to 16 px).
- **What is wrong:** Outside the landing headline, the largest text on any page is 16 px. Finding titles are 14 px semibold on home and the rail, but 16 px regular in "Recorded 2 findings". The `n = 11` formulas switch to a different digit style (tabular, mono-like) inside proportional text, so "= 11" looks heavier than the words around it. The inline path `research/proof-sketch.md` in a finding body is visibly larger than the 14 px sans text around it.
- **Why it is wrong:** The product pages have no clear top level. Mixed digit styles and a bigger inline mono make lines look uneven.
- **Fix:** Define four steps (12, 14, 16, 24) and assign each role once. Use the same digit style for numbers in prose. Set inline code at 0.9 em of its parent.

## 16. Session: the "Files" list does not look like part of the same rail

- **Page / theme / width:** session, both themes, 1440 and mobile drawer.
- **Where:** "Files 7" at the bottom of the rail.
- **What is wrong:** Findings and Call tree use separators between rows. Files uses none. The file names are 12 px mono in a light grey that has low contrast in dark mode. They do not look clickable.
- **Why it is wrong:** The third section breaks the rail's own pattern. Low contrast mono at 12 px is hard to read.
- **Fix:** Use the same row height and separator as the Call tree. Raise the colour to the secondary text token, set 13 px, and add a file icon or a hover underline.

## 17. Session, desktop: Call tree separators ignore the indent

- **Page / theme / width:** session, both themes, 1440.
- **Where:** rows "reader", "compute-perm", "compute-dyck".
- **What is wrong:** The child labels are indented by 16 px, but the separator lines start at the rail's left edge.
- **Why it is wrong:** The indent says "child", the full-width line says "sibling". The tree hierarchy is weaker than it should be.
- **Fix:** Start child separators at the indent, or add a vertical guide line from "lead" to its children.

## 18. Session, mobile: the composer helper text disappears

- **Page / theme / width:** session, both themes, 390.
- **Where:** below "Reply to lumen".
- **What is wrong:** Desktop shows "lumen keeps working while you write. It reads your message at its next step." Mobile shows nothing. On home mobile, the composer itself is not visible (problem 1).
- **Why it is wrong:** The sentence explains a non-obvious behaviour. It is not decoration.
- **Fix:** Keep the helper text on mobile, one line, 12 px, below the composer.

## 19. Composer details

- **Page / theme / width:** landing, home, session, both themes, 1440.
- **Where:** the input bar.
- **What is wrong:** The paperclip icon is mid-grey while the "Attach" label beside it is darker, so the pair looks like two different controls. The helper text sits only about 8 px under the input, closer than the tabs sit above it (about 10 px), so it reads as part of the input. In dark mode, the send button is a solid white square that is the brightest object on the page, brighter than the headline.
- **Why it is wrong:** Small, but this component is on all three pages, so every flaw repeats three times.
- **Fix:** Give the icon and label the same colour. Use 12 px above the helper text. In dark mode, use an off-white or primary-tinted fill for the send button.

---

## Verdict

I would not ship this. The visual base is consistent and calm: one typeface, one grid, one composer, a clear monochrome palette that works in both themes. But two defects stop a mobile user cold. On home, the composer and findings are hidden in a 48 px strip (problem 1). On session, the command output is cut off (problem 2). Those two are release blockers. After them, the main weakness is hierarchy. The product pages have no large type and no anchored layout, so home looks half-empty and session looks like a flat list. Status, which is the main thing a user scans for, uses three different visual treatments. One of them, the dashed outline, looks like a focus ring. Fix problems 1 to 3 before release. Fix 4 to 8 in the same pass if time allows, because they decide whether the three pages read as one product. The rest is polish.
