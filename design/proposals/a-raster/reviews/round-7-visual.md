# Visual review: landing, home, session

I took screenshots at 1440x900 and 390x844, in light and dark. I scrolled the internal scroll areas (the home list, the session log, the session rail and the mobile drawer) and zoomed in at 2x and 3x where I needed detail. The ranking is from worst to least bad.

## 1. Mobile home: the primary action is about 1000 px below the fold

- **Page and view:** home, 390 px, light and dark.
- **Where:** "New project" and its composer come after all 7 project rows, on a grey band at the bottom of the scroll.
- **What is wrong:** On first view the page shows only the list. You must scroll past every project to start a new one, and the list will grow.
- **Why it is wrong:** On desktop the composer is always visible in the rail. On mobile the main entry point of the product disappears.
- **Fix:** Put a compact composer, or a full-width "New project" button, directly below the header, above "Projects". Show "Latest findings" after the list, or behind a tab.

## 2. Mobile session header: three rows of chrome with unaligned controls

- **Page and view:** session, 390 px, both themes.
- **Where:** the top 120 px.
  - Row 1: "lumen", the [Findings] box and the avatar.
  - Row 2: the breadcrumb.
  - Row 3: "Running", "$0.94 spent" and the [Stop] box.
- **What is wrong:**
  - The header takes 14% of the screen.
  - [Stop] floats in the middle of row 3. It ends at about x=331, but the content edge is at x=370, so it aligns with nothing.
  - [Findings] and [Stop] are the same outlined rectangle, so a navigation toggle and a destructive action look equal.
  - The elapsed time disappears without a replacement.
  - Below the header border, a 3 px sliver of the clipped grey "You" bubble shows under the "You" label. It reads like a stray rule.
- **Fix:**
  - Merge the rows into two. Row 1 holds the back arrow, the project title and the avatar. Row 2 holds the status, the cost and a right-aligned [Stop].
  - Give [Stop] a destructive treatment, such as a red outline or text, or put it in an overflow menu.
  - Make [Findings] an icon button or a bottom tab.
  - Add a top fade to the log so that clipped content does not show as fragments.

## 3. Mobile session: code output is cut off with no sign that it scrolls

- **Page and view:** session, 390 px, both themes.
- **Where:** the "Ran 2 min 41 s" block.
- **What is wrong:** "distinct ima…" and the "yes" column are cut off at the right edge. There is no fade, scrollbar or wrap.
- **Why it is wrong:** This output is the evidence the product sells. When the result column is cut off, the evidence is cut off.
- **Fix:** Add a right-edge fade and a visible scroll hint. Alternatively, reflow the output on narrow screens: put each result line under its label, or use a smaller monospace size such as 11 px with `white-space: pre` and horizontal scroll.

## 4. Mobile drawer: the scroll fade sits over the middle of the list

- **Page and view:** session drawer ("Findings and files"), 390 px, light. I saw it after the drawer had settled for 3 s.
- **Where:** the Files list. The second row, `results/fertility_n11.csv`, is washed out and its descenders are clipped. The rows below it are crisp.
- **What is wrong:** The fade overlay is in the wrong place. It covers one row in the middle of the content, not the bottom edge of the viewport.
- **Why it is wrong:** It looks like a rendering bug, and it is one. It also makes one file look disabled.
- **Fix:** Anchor the "more below" fade to the bottom of the drawer viewport (position sticky/fixed bottom 0), or remove it when the drawer opens.

## 5. Status badges look like buttons, and the heavy style goes to the wrong state

- **Page and view:** home rail, session rail, session log and mobile drawer, both themes, both widths.
- **Where:** "Confirmed", "Open question" and "Dropped".
- **What is wrong:**
  - There are three badge styles:
    - "Confirmed": a solid mid-grey fill.
    - "Open question": a black 1 px outline.
    - "Dropped": a faint grey outline with grey text.
  - All three are sharp-cornered rectangles with 12 px text. [Stop] and [Findings] use the same shape.
  - "Confirmed" is the heaviest mark on every row, but it is the settled state.
  - In light mode, the grey fill with white text looks like a disabled button.
  - In dark mode, "Confirmed" (light grey fill) and "Open question" (white outline) have almost the same visual weight.
- **Why it is wrong:** Badges and buttons must look different, or users click badges. The state that needs attention ("Open question") must be the louder one.
- **Fix:** Make badges a separate shape: pill radius, no border, tinted background, sentence-case 12 px medium. Give each state its own tone:
  - Confirmed: quiet, such as a neutral tint with a check icon.
  - Open question: an accent tint.
  - Dropped: text only, struck or muted.
  Keep rectangles for buttons only.

## 6. Five different button styles

- **Page and view:** all pages.
- **What is wrong:** The pages use five button treatments:
  - Solid black square: submit arrow.
  - Wide outlined rectangle: [Stop].
  - Tight outlined rectangle: [Findings].
  - Underlined text link: "Show all 5".
  - Plain text: "Close", "Docs", "Sign in".
  Sizes also differ. [Stop] is 28 px tall on desktop, the submit button is 50 px, and the avatar is a 32 px circle beside square buttons.
- **Why it is wrong:** Five styles with no rule behind them read as five authors. The user cannot learn what is clickable.
- **Fix:** Define three styles and use only those:
  - Primary: solid.
  - Secondary: outline.
  - Ghost: text.
  Use one height (for example 36 px) and one radius. Map every control to one of them. "Show all 5" and "Close" become ghost buttons. [Stop] and [Findings] become secondary.

## 7. Desktop session header: the cluster is unbalanced and [Stop] is oversized

- **Page and view:** session, 1440 px, both themes.
- **Where:** the top right.
- **What is wrong:**
  - [Stop] is a 136 px wide box around a four-letter word.
  - There is an 84 px empty gap between [Stop] and the avatar. Other items in the cluster are 16 px apart.
  - The status group starts near x=835, so the header has a large empty middle and a crowded right side.
  - [Stop] has no colour or icon that marks it as destructive.
- **Fix:**
  - Size [Stop] to its content plus padding (about 72 px) and add a stop icon.
  - Use one gap between all header items, for example 16–24 px.
  - Group status, cost and time as one quiet meta line, and keep [Stop] as the only control beside the avatar.

## 8. Session log: too many small type sizes and six list styles

- **Page and view:** session, both widths, both themes.
- **Where:** inside every "lumen" turn (Thinking, Searched, Started 3 agents, Saved a file, Ran, Recorded N findings).
- **What is wrong:**
  - One turn uses about seven text styles:
    - 14 px semibold: the speaker label.
    - 12 px semibold: the step labels.
    - 12 px grey: the step meta.
    - 14 px grey: the thinking body.
    - 13 px mono: the code output.
    - 14 px black: the table rows.
    - 16 px: the reply.
  - The sizes are close to each other, so the eye cannot rank them. Each step is marked only by a tiny bold label.
  - The steps also use six different list treatments:
    - "Searched": a 3-column table with right-aligned results.
    - "Started 3 agents": a 3-column table with a different first column.
    - "Saved a file": a single row with "28 lines".
    - "Recorded": a 2-column table with badges.
    - The call tree in the rail: an indented list with a rule.
    - Files in the rail: monospace rows.
  - The thinking text runs the full 760 px measure, so lines are too long for grey 14 px text.
- **Why it is wrong:** The log is the core of the product, and it reads as one grey slab. The final answer at 16 px does not stand out enough from the work above it.
- **Fix:**
  - Use a type ladder of four sizes: 16 for the reply, 14 for step bodies, 12 for labels and meta, and 13 for mono.
  - Give each step a small icon and a fixed 2-column grid: label on the left, content on the right.
  - Make all row lists the same component, with one row height, one divider and one right-aligned result column.
  - Cap the measure at about 68ch.
  - Separate the reply from the activity with more space (32 px) and stronger weight. The activity can also collapse by default.

## 9. Desktop home: the rail has an empty bottom and the hierarchy is flat

- **Page and view:** home, 1440 px, both themes.
- **Where:** the right rail and both column headings.
- **What is wrong:**
  - The grey rail ends its content at y≈585, and about 315 px of grey is empty below it.
  - "Projects" and "New project" are the same 18 px semibold. The page has no title and no single primary focus.
  - The 160 px status column holds mostly the word "Finished".
- **Fix:**
  - Let the rail background end with its content (a card), or fill the rail with a longer findings list.
  - Promote one heading. Either move "New project" above the list as the page lead, or give "Projects" a larger page-title size (24 px).
  - Make the status column narrower (about 120 px), or put status under the title as on mobile.

## 10. Landing, desktop: the sphere has flat edges, and in dark mode it looks lopsided

- **Page and view:** landing, 1440 px, both themes; also 390 px.
- **Where:** the raster sphere on the right.
- **What is wrong:**
  - The dot grid clips the circle into stair steps. At 2x the left, right and top edges are visibly flat, so the shape reads as a rounded square.
  - In dark mode the shadow side fades to the background. You see a bright crescent on the left, so the sphere looks shifted left and smaller than its light-mode twin.
  - In light mode the shadow side is a dense black mass. It is the heaviest object on the page and pulls the eye away from the headline and the composer.
- **Fix:**
  - Mask the dots with a true circle and scale the dots near the rim down to zero, so the edge is round.
  - In dark mode, keep a faint rim of dots on the shadow side so that the full disc stays legible.
  - In light mode, cap the maximum dot size so that the darkest area is about 70% ink, not solid.

## 11. Landing, mobile: dead gap between the sphere and the headline

- **Page and view:** landing, 390 px, both themes.
- **Where:** between the sphere (it ends at y≈270) and the headline (it starts at y≈415).
- **What is wrong:** There are about 145 px of nothing. The sphere is also small (200 px), so the page reads as two unrelated pieces. The composer is pushed down to y≈675–748.
- **Fix:** Reduce the gap to 32–48 px, or let the sphere bleed behind the headline at low opacity. The composer then moves up into the comfortable thumb zone.

## 12. Desktop home and session: the main column has unequal gutters

- **Page and view:** home and session, 1440 px.
- **Where:** the main column. Content starts at x=40 and ends at x=823. The rail starts at x=847, with 40 px of inner padding.
- **What is wrong:** There are 40 px on the left but only 24 px between the content and the rail. Dividers and right-aligned prices run almost into the rail edge.
- **Fix:** Use 40 px on both sides of the main column, the same as the rail padding.

## 13. Desktop session: no top fade on the log

- **Page and view:** session, 1440 px, both themes, default view (the log opens scrolled to the bottom).
- **Where:** directly under the header border.
- **What is wrong:** A half-visible turn starts 14 px under the header line ("lumen", then text mid-paragraph). The bottom of the log has a fade above the composer, but the top has none.
- **Fix:** Add the same fade at the top when there is content above, plus a "Jump to start" or "N earlier steps" affordance.

## 14. Status colour and status dots

- **Page and view:** home, both widths, both themes; session call tree.
- **What is wrong:**
  - "Waiting on you" is the only saturated colour in the whole product, and it is error red. It reads as a failure, not as a request.
  - The row has no visible action: there is no "Review" or "Approve" button.
  - The status dots are about 6 px and almost the same: filled black for running, filled grey for finished, hollow for stopped. In dark mode, the grey finished dot and the hollow stopped dot are hard to tell apart.
- **Fix:**
  - Use an amber or brand accent for "needs you", and add an inline action button on that row.
  - Make the dots 8 px and give each state a different shape or icon, not only a tone.

## 15. Baseline misalignment in meta rows

- **Page and view:** home, 390 px (meta row "● Waiting on you   $0.18   Updated 2 h ago"); home, 1440 px (status label next to the title).
- **What is wrong:** "Updated 2 h ago" sits about 4 px above the baseline of "$0.18". On desktop, the 14 px status label sits about 2–3 px below the 16 px title baseline. The items are top-aligned, not baseline-aligned.
- **Fix:** Use `align-items: baseline` on these rows, or one line-height for the whole row.

## 16. Rail sections are not built the same way

- **Page and view:** session rail and drawer, both widths and themes.
- **What is wrong:**
  - "Findings" and "Call tree" have a 12 px subtitle. "Files" has none, and it has a larger gap (about 40 px) before its first row.
  - In the call tree, the lead row has a divider, but the child rows have none.
  - "Show all 5" is the only underlined link in the product.
  - The drawer title "Findings and files" is 14 px, which is smaller than its own 18 px section headings. It also does not mention the call tree inside it.
  - "Close" is plain text.
- **Fix:**
  - Use one section template: heading, optional subtitle, and one fixed gap.
  - Use one divider rule for all rows.
  - Name the drawer "Details", give it the largest heading in the drawer, and use an icon close button.

## 17. Microtext is too small and too pale

- **Page and view:** all pages, both themes.
- **Where:**
  - "lumen picks its own question and reports back…"
  - "lumen keeps working while you write…"
  - "lumen (lm), the SI unit of luminous flux."
  - The finding meta ("Pop-stack fertility, 4 min ago").
  - The rail subtitles.
- **What is wrong:** The text is about 12 px in mid grey. In dark mode it is close to the minimum readable contrast, and the footnote on the landing page is close to invisible.
- **Fix:** Set the minimum size to 13 px with contrast of at least 4.5:1. Remove the landing footnote, or move it into a real footer row with the Docs and Sign in links.

## 18. The landing page and the app look like two products

- **Page and view:** landing compared with home and session, all views.
- **What is wrong:**
  - The landing page has a 56 px display headline, a large raster sphere and a two-tone headline with a grey "Just start.".
  - The app pages have no type larger than 18 px and no graphic element. The raster idea survives only as a background dot texture that you can barely see.
  - The wordmark "lumen" is plain 15 px semibold text with no mark, so nothing carries the brand from page to page.
- **Fix:**
  - Bring one element from the landing page into the app, such as a small raster sphere as the logo mark, or a raster progress glyph for "Running".
  - Add one intermediate heading size (24–28 px) for page titles, for example the project title on the session page.

## Verdict

I would not ship this yet. The base is calm and disciplined. The monochrome palette and the shared composer give the three pages a starting point for one product. But the mobile layouts are not finished:

- On home, the main action is buried under the whole list.
- On session, the header uses three rows and its controls do not align.
- The code evidence is cut off.
- The drawer has a visible fade bug.

Across all pages, badges and buttons share one shape, the heavy badge style goes to the wrong state, and the session log flattens into one grey mass of near-identical small text. Fix items 1–8 first: they are layout and component-system fixes, not a redesign. With those fixed and the sphere edge cleaned up, this would be a coherent, good-looking product.
