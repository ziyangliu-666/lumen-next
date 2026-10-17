# Visual review: landing, home, session

Method: I took Playwright screenshots of each page at 1440x900 and 390x844, in light and dark. I also took 2x crops, scrolled states of the inner scroll areas, and the mobile "Findings" drawer. I judged only what was on screen.

Problems are in rank order, worst first.

---

## 1. The scroll fade makes surfaces transparent, so content from behind shows through

- **Page:** session (drawer), home, session (rail)
- **Theme / width:** both themes. Worst at 390. Also visible at 1440.
- **Where:**
  - Session 390, "Findings" drawer, scrolled: the drawer title "Findings and files" prints on top of the page logo "lumen". "Close" prints on top of the "LZ" avatar box, and the page's own "Findings" link shows faintly between them.
  - Session 390, drawer at rest, bottom edge: "results/fertility_n11.csv" overlaps a ghost line of other text ("research/p...").
  - Home 390, list scrolled: the black submit button turns into a grey gradient smear under the header.
  - Session 1440, right rail, bottom: the grey rail fades to the page colour (white in light, black in dark), not to the rail colour. The rail looks as if it dissolves.
- **What is wrong:** the edge fade acts as an alpha mask on the whole region, background included. It does not act as an overlay in the surface colour. Anything behind the region becomes visible.
- **Why it matters:** overlapping text is the most visible kind of defect. A user sees it on the first scroll of the mobile drawer. It reads as broken, not as unpolished.
- **Fix:** draw the fade as a gradient overlay in the colour of the scrolling surface (`surface` for the rail and drawer, `background` for the log and home main). Do not mask the container. Give the drawer an opaque background and an opaque, sticky title bar. On desktop the rail overflows by only about 18 px. Fit the rail, or remove the fade when the overflow is that small.

## 2. Status has five different visual treatments across the product

- **Page:** home and session
- **Theme / width:** all
- **Where:**
  - Home list: "Waiting on you" is a red dot and red text. "Running" is a black dot with a grey halo and black text. "Finished" and "Stopped" are grey text without a dot.
  - Session header and call tree: "Running" is a dot. "Finished" is grey text.
  - Session findings (rail and inline "Recorded 2 findings"): "Confirmed" is a grey filled chip. "Open question" is an outlined chip.
- **What is wrong:** a project status and a finding status are both state labels, but they look like two unrelated systems. Inside one system the dot appears on some states and not on others. The chips are about 13 px and the plain labels are about 14 px.
- **Why it matters:** a user cannot learn one visual rule for "state". On home, rows with a dot read as more important than rows without one. That is correct for "Waiting on you", but not for the difference between "Running" and "Finished".
- **Fix:** define one status component with one size and one shape. Every state gets a leading dot: red for waiting, solid foreground for running, muted for finished, hollow for stopped. Use the same component for findings ("Confirmed" solid, "Open question" hollow), or move finding states to the same chip style everywhere. Put status labels on the same baseline as the title. At present they sit about 2 px lower than the title on home.

## 3. The landing sphere is crude in light mode and does not match dark mode

- **Page:** landing
- **Theme / width:** light at both widths. Dark at both widths, for different reasons.
- **Where:** the right half at 1440, the top block at 390.
- **What is wrong:**
  - Light: the "cast shadow" ellipse under the sphere runs into the lowest rows of the sphere. There is no gap and no clear contact line, so the bottom reads as a smudge of mixed dot sizes.
  - Light: every dot on the rim is full size, including the rim on the lit side. This gives the sphere a heavy black outline that contradicts the light source.
  - Both: the silhouette is stair-stepped. The top is a flat row of about 14 dots, the sides have straight vertical runs, and the right side has a bump. At 390 the flat sides are obvious. It reads as a low-resolution circle, not as a sphere.
  - Dark: the bright core fills in to a solid white blob with diamond holes. The halftone texture disappears where it should be strongest. There is no cast shadow, so the two themes show two different objects.
- **Why it matters:** this is the only image in the product and the first thing on the first page. It sets the quality bar for everything after it.
- **Fix:** clip the dot field to a true circle with sub-dot precision (scale the edge dots by coverage). Make rim dot size follow the shading, not a fixed maximum. Put the shadow below the sphere with a visible gap, or remove it. Clamp maximum dot size in dark so that dots never touch. Use the same light direction and the same props in both themes.

## 4. Speaker labels do not align with their messages in the session log

- **Page:** session
- **Theme / width:** both themes, 1440
- **Where:** the left label column ("lumen", "You").
- **What is wrong:** for a plain-prose message the label sits about 10 to 12 px above the first line of text ("lumen" at the top of the log). For a message that opens with a "Thinking" block, the label sits about 6 px below the first line. Only "You" lines up.
- **Why it matters:** the two-column log depends on a horizontal relation between label and content. When the offset changes from message to message, the column looks loose and the eye cannot pair a label with its message.
- **Fix:** align every label to the cap height of the first line of its message. Remove the top margin from the first child of a message, so prose and blocks start at the same y.

## 5. Home at 1440: the list row splits into two halves with a dead gap between them

- **Page:** home
- **Theme / width:** both themes, 1440
- **Where:** the project list and the composer above it.
- **What is wrong:**
  - The description text stops at about x = 850. The price and "Updated" stop at x = 1400. That leaves about 450 px of nothing in the middle of every row, and a hairline across all of it.
  - The left gutter is about 230 px wide and holds only two grey labels, "New project" and "Projects 4".
  - The composer input is about 1130 px wide for a one-line prompt. On the landing page the same control is about 550 px wide.
  - Below the four rows, the lower third of the screen is empty.
- **Why it matters:** the eye must jump across a gap to connect a project to its cost. The page looks sparse at the top and empty at the bottom at the same time. The same control at two very different widths weakens the link between landing and home.
- **Fix:** cap the content column at about 880 px (gutter plus list). Then price and time sit next to the text. Cap the composer at the landing width, or at the list width. Alternatively, move the gutter labels above their sections and use the full width for a denser table with columns for status, cost and time.

## 6. Mobile session: the chrome takes too much height, and the code block is clipped

- **Page:** session
- **Theme / width:** both themes, 390
- **Where:** header, "Ran" code block, "Searched" table.
- **What is wrong:**
  - The header has three rows (logo and actions, breadcrumb, status and cost) and uses about 113 px. The composer and its helper text use about 115 px more. The log gets about 610 of 844 px.
  - The code block cuts its lines at the right edge ("--tally-preima", "distin"). There is no fade, scrollbar or other sign that the block scrolls.
  - In the "Searched" table the source column ("arXiv", "OEIS") takes about 40 % of the width. The query and the result then wrap into two or three lines each.
- **Why it matters:** on a phone the log is the product. Clipped code with no affordance looks like lost data.
- **Fix:** merge the breadcrumb and the status into one line (project name, then a status dot and cost), or hide the breadcrumb at this width. Shorten the composer helper text to one line or hide it after the first message. Wrap code lines, or show a right-edge fade on the code block. Stack the source as a small label above the query in the table.

## 7. Mobile home: the meta column squeezes titles, so the status moves from row to row

- **Page:** home
- **Theme / width:** both themes, 390
- **Where:** each project row.
- **What is wrong:** price and "Updated ..." keep a right column of about 130 px. Titles wrap to two lines ("Pinnacle sets of / permutations"). When the title wraps, the status drops to its own line. When it does not wrap ("Pop-stack fertility"), the status stays inline. Each row has a different internal structure.
- **Why it matters:** a list must have one rhythm so that the user can scan the same spot on each row. Here the status, which is the most important field, is in a different place on every row.
- **Fix:** at this width give the title the full row width. Put status, price and time on one meta line below the title, always in the same order.

## 8. Right edges inside the session log do not line up

- **Page:** session
- **Theme / width:** both themes, 1440
- **Where:** the main log column.
- **What is wrong:** prose runs to about x = 938, and so does the composer. The "Searched", "Started 3 agents", "Recorded 2 findings" tables and the code block stop at about x = 896. The "Thinking" text inside the same block runs past the tables to about x = 905.
- **Why it matters:** three right edges within 40 px read as error, not as intent. The chips ("Confirmed", "Open question") hang on the short edge, so they do not line up with anything else.
- **Fix:** let every block inside a message fill the message width. The indent of the left rule is enough to group them.

## 9. Rules have three weights, and the header rule changes between themes

- **Page:** all app pages
- **Theme / width:** light vs dark, both widths
- **Where:** below the header; between home sections; between rows and messages.
- **What is wrong:** in light, the header rule is solid black at full bleed. The home section divider is light grey at full bleed. The row and message dividers are light grey and inset to the content column. In dark, the header rule is grey, the same as the others.
- **Why it matters:** the black line is the heaviest mark on home and session after the titles. It pulls attention to the top edge. The difference between themes shows that the token is wrong in one of them.
- **Fix:** use one border token for every rule. If the header needs more weight, give it the surface colour, not a darker line. Make the light and dark themes use the same token.

## 10. The type scale has too many small steps, and the smallest text is too faint

- **Page:** all
- **Theme / width:** all, worst in light
- **Where:**
  - Helper text under every composer ("lumen picks its own question...", "lumen keeps working while you write...").
  - Rail subtitles ("What lumen has checked, newest first.").
  - Landing footer ("lumen (lm), the SI unit...").
  - Block labels "Thinking", "Ran", "Searched".
- **What is wrong:** the session page alone uses about seven sizes between 12 and 17 px (prose, thinking, table, rail headings, block labels, chips, helper). The 12 px grey helper and subtitle text look lighter than 4.5:1 against the background. "Thinking" is a 13 px bold label, but it introduces 15 px text, so the label is smaller than what it labels.
- **Why it matters:** small differences in size and weight read as noise, not as hierarchy. Faint 12 px text is hard to read and is an accessibility risk.
- **Fix:** reduce to four steps: display, body (16), secondary (14), caption (13). Make caption text at least the muted-foreground contrast used for descriptions on home. Make block labels the secondary size in medium weight.

## 11. Money and header content are not consistent between home and session

- **Page:** home and session
- **Theme / width:** all
- **Where:** headers and list.
- **What is wrong:** home shows "$1.55 of $200 this month" with the amount in bold. Session shows "$0.94" in regular weight with "for 2 h 14 min", and has no monthly budget. Home list prices are bold. The session status cluster floats at the left edge of the rail, far from the avatar. On home the cluster sits next to the avatar.
- **Why it matters:** the same kind of number is styled two ways, and the header changes its layout between two pages of one app.
- **Fix:** choose one style for currency (regular weight, tabular figures, foreground colour). Keep the account area (budget and avatar) fixed at the right on every page. Put session status in its own slot next to the breadcrumb.

## 12. Landing composition: the sphere floats, and the lower band is empty

- **Page:** landing
- **Theme / width:** both themes, 1440
- **Where:** the right half, and the area below the form.
- **What is wrong:** the sphere ends at about x = 1290, while the nav ends at x = 1400. It aligns to neither the right margin nor the centre of the right half. Below the helper text there are about 220 px of nothing, then a single 12 px footer line alone in the bottom-left corner.
- **Why it matters:** the page has strong left alignment, and the art does not commit to a grid line. The orphaned footer looks left over.
- **Fix:** centre the sphere in the right column, or align its right edge to the 1400 margin. Move the footnote nearer the form, or put it in a real footer row with the nav links.

## 13. User turns and agent turns look the same

- **Page:** session
- **Theme / width:** all
- **Where:** the log.
- **What is wrong:** the only difference between a "You" turn and a "lumen" turn is the label and a small change in weight. At 390 the user's message is larger and heavier than the agent prose, so the short instruction outweighs the result.
- **Why it matters:** in a long log, the user needs to find their own instructions fast. The current hierarchy also gives the most weight to the least important text.
- **Fix:** keep user text at body size and weight, and mark user turns with a quiet surface band or a left rule in the foreground colour.

## 14. Mobile drawer details

- **Page:** session
- **Theme / width:** both themes, 390
- **Where:** the "Findings" drawer.
- **What is wrong:** the header link says "Findings". The drawer title says "Findings and files", and the drawer also holds the call tree. A 1 to 2 px strip of the page shows at the left edge of the drawer.
- **Fix:** name the link and the drawer the same ("Details" or "Findings and files"). Make the drawer full width, or give it a real left border and a scrim.

---

## Verdict

I would not ship this as it is. The base is good: one typeface, a strict monochrome palette, square controls, and the same composer on all three pages. These already make the three pages read as one product. But the fade bug (problem 1) puts overlapping text on screen in the mobile drawer, and it dissolves the rail on desktop. That alone blocks release. After that, the product does not yet have one visual rule for status, one rule for alignment in the log, or one type scale. The landing illustration, the first thing a visitor sees, looks rasterised and different in each theme. Problems 1 to 4 are a short, contained fix list, and problems 5 to 8 are layout tuning. With those done, I would ship.
