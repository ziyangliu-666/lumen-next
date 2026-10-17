# Visual review: landing, home, session

Method: Playwright screenshots at 1440x900 and 390x844, light and dark, plus scrolled states, the mobile Findings drawer, and 3x crops. Ranked worst first. Coordinates are CSS pixels.

## 1. Home, desktop, both themes: the bottom half of the page is empty
- **Where:** both columns, from y ~520 (left) and y ~590 (right) down to 900.
- **What is wrong:** four project rows and four findings fill the top 55 % of the screen. The rest is blank white on the left and blank grey on the right. The grey rail panel runs to the bottom edge with nothing in it, so the empty space looks deliberate and unfinished at the same time.
- **Why:** the page looks like a loading state or a broken query. The full-height grey panel draws attention to the gap.
- **Fix:** make the layout follow the content. Center the two columns in a max-width container (about 1200 px) and let the rail panel end with its content, as a card. Or fill the space with useful content: a "Recent activity" list, or an empty-state row under the projects ("Start another project" with the composer). Do not stretch a filled panel to 100vh when it holds 500 px of content.

## 2. All pages: the landing page and the app look like two different products
- **Where:** landing (halftone sphere, no header rule, open canvas) compared with home and session (header rule, grey right rail, list rows).
- **What is wrong:** the halftone sphere is the only identity element, and it does not appear anywhere after sign-in. The dot-grid background is clear on landing and on mobile, but on desktop home and session the grey rail covers half of it, and it is almost invisible on the white half. The landing header has no rule; the app header has a full-width rule.
- **Why:** a user who signs in loses every visual cue from the page that sold the product. The app reads as a generic monochrome admin template.
- **Fix:** carry one element across. Options: a small halftone mark as the logo next to "lumen" on every page; a halftone motif in empty states and in the "Running" indicator. Use the dot grid on all pages at the same strength or on none. Give the landing header the same rule, or remove the rule from the app header.

## 3. Session, mobile, both themes: the header takes three rows and gives Stop the same weight as Findings
- **Where:** top 120 px (14 % of the viewport): row 1 "lumen / Findings / LZ", row 2 breadcrumb, row 3 "Running $0.94 spent Stop".
- **What is wrong:** the header is too tall for a chat view. "Findings" (navigation) and "Stop" (a destructive action that ends a paid run) use the same outlined button style. "Stop" is wide and sits in the middle of the row, with no relation to the edge or to the button above it. The elapsed time is dropped without a replacement.
- **Why:** the log, the main content, gets 600 px of 844. A user can tap Stop by mistake, because it looks like every other button.
- **Fix:** reduce the header to two rows: row 1 is the back arrow, the project title, and the avatar; row 2 is status, cost, and the actions. Put "Findings" as an icon button or a bottom tab. Make Stop visually distinct (red text or red outline) and confirm before it acts. Right-align Stop with the avatar.

## 4. Session, mobile, both themes: the code output is clipped with no scroll cue
- **Where:** "Ran" block, y ~335–430; text ends as "distinct ima" and "ye".
- **What is wrong:** the monospaced output overflows to the right and is cut at the box edge. There is no fade, no scrollbar, no wrap.
- **Why:** the result ("yes") is the important part, and it is hidden. It looks like a rendering bug.
- **Fix:** reduce the mono size on mobile to 12 px and wrap, or keep it scrollable with a right-edge fade and a visible scrollbar. Better: render the result lines as a key/value list on mobile.

## 5. Session, both widths: scroll containers clip content badly
- **Rail, desktop, both themes:** the last file row "research/literature.md" is cut in half at the bottom edge (y ~860). The rail overflows by only about 13 px, so the user scrolls 13 px and then the "Findings" heading is clipped under a top fade. Fix: add bottom padding so the rail fits without scrolling, or make the overflow large enough to read as a scroll region and add a bottom fade.
- **Drawer, mobile, both themes:** in the Files list, the second row "results/fertility_n11.csv" is faded to almost invisible, and the row below it is fully opaque. A fade mask sits in the middle of the list, not at the edge of the scroll area. Fix: attach the fade to the bottom edge of the scroll container.
- **Log, mobile, initial view:** the log opens scrolled to the end, and the top shows a "You" label with only the bottom 4 px of its grey message box under the header. It looks like a broken grey bar. Fix: snap the scroll position to a message boundary, or put a top fade under the header.

## 6. Session, both widths and themes: the user message is heavier than the agent's evidence
- **Where:** "You" blocks (filled grey box, 16 px text with large padding) against "Ran" output (white box with a 1 px border) and agent prose (no container).
- **What is wrong:** the filled box is the strongest shape in the log. The user's one-line instruction outweighs the computation result and the findings. The agent's own conclusions sit in plain text with no container.
- **Why:** the product promise is "evidence". The visual hierarchy makes the user's input the main object.
- **Fix:** make the user message lighter: a left rule or a smaller tinted block with less padding. Give the agent's final conclusion paragraph more weight, or a "Result" label. Keep the code block as the only boxed element.

## 7. Session, desktop, both themes: the "Searched" and "Started 3 agents" tables are too wide
- **Where:** log, top section; column 1 at x ~55, column 2 at x ~180, column 3 right-aligned at x ~795.
- **What is wrong:** the result column ("41 papers", "Finished") sits about 500 px away from the query it belongs to. The "Started 3 agents" table repeats the call tree that is already in the rail.
- **Why:** the eye must jump across empty space to pair a query with its result. Duplicate content adds noise in a dense view.
- **Fix:** limit inline tables to about 560 px, or put the result directly after the query in muted text. In the log, replace the agent table with one line ("Started reader, compute-perm, compute-dyck") that links to the call tree.

## 8. Home and session, both themes: the badge system has three styles and the wrong emphasis
- **Where:** "Confirmed" (filled), "Open question" (outlined), "Dropped" (grey outlined, only in the session log).
- **What is wrong:** in dark mode "Confirmed" becomes a solid white block, the brightest element in the rail. The badge text is about 12 px with 2–3 px vertical padding, so it is cramped next to 14 px titles. "Dropped" is a third variant that appears on one page only.
- **Why:** the eye goes to the brightest shape first, so in dark mode the rail reads as a column of white labels, not as a list of findings. Three variants without a key look accidental.
- **Fix:** define one badge component with three documented states. Use a tinted fill for Confirmed (for example a subtle green or a low-contrast neutral), an outline for Open question, and muted text with strikethrough or a lighter outline for Dropped. Use 4 px 8 px padding and a 12 px minimum height for the text line.

## 9. Home and session, both themes: "Running" and "Finished" look the same
- **Where:** home status column (x 40); session call tree (x ~1330); session header.
- **What is wrong:** Running is a solid black (white in dark) 6 px dot. Finished is a solid grey 6 px dot. At this size the difference is very small. Only "Waiting on you" has a colour.
- **Why:** "running" is the state the user most wants to see at a glance. It does not look live.
- **Fix:** give Running a distinct shape or motion: a pulsing ring, or the halftone motif from landing. Use a check or a hollow dot for Finished, so that the states differ by shape, not only by grey level.

## 10. Landing, desktop, both themes: dead band at the bottom and an orphan footnote
- **Where:** from y ~650 to ~860, with "lumen (lm), the SI unit of luminous flux." alone at y 868.
- **What is wrong:** the hero block and the sphere sit in the top 75 %. Below them is 200 px of nothing, and then an 11 px footnote that looks like debug text. The gap between the text column (ends x ~593) and the sphere (starts x ~853) is 260 px, so the two halves do not read as one composition.
- **Why:** the page looks unfinished, and the footnote looks like a leftover.
- **Fix:** center the hero vertically in the viewport. Move the sphere about 100 px left, or widen the text column to 640 px. Give the footnote a footer row with a rule and the same 40 px side margin, or set it under the composer helper text.

## 11. Landing, both widths: the sphere loses its edge
- **Where:** sphere. Dark mode: the right limb fades into the background. Light mode: the highlight at upper left reads as a hole.
- **What is wrong:** the silhouette is not continuous, so the shape reads as a blob rather than a sphere.
- **Why:** this is the only brand image. Its form should be exact.
- **Fix:** keep a minimum dot size at the limb so the outline holds on the dark side, and in light mode keep a minimum dot size in the highlight.

## 12. Landing, mobile, both themes: large gap between the sphere and the headline
- **Where:** from y ~270 to ~440.
- **What is wrong:** about 170 px of empty space between the image and the headline. The composer starts at y ~700 and its helper text sits close to the fold.
- **Why:** the call to action is pushed down for no reason. The sphere and the text read as two separate screens.
- **Fix:** cut the gap to 32–48 px, or make the sphere smaller (about 200 px). The composer then sits in the middle of the first screen.

## 13. All pages: type sizes and weights are not consistent
- Project titles on home are 16 px; finding titles on home and session are 14 px. Both are row titles of the same kind.
- Cost: home shows "**$1.55** of $200" (only the number bold); session shows "**$0.94 spent**" (all bold).
- There are three 12 px grey helper lines under composers (landing, home, session). They are hard to read in dark mode.
- In the findings rail, the inline mono file name ("research/proof-sketch.md") looks larger and heavier than the 14 px sans text around it.
- In the session rail, "Findings" and "Call tree" have a subtitle line and "Files" does not. Files rows are about 25 px high and call tree rows are about 29 px.
- **Fix:** define one row-title size (15–16 px semibold) for all list rows, one cost format, and 13 px minimum for helper text. Set inline mono at 0.9 em. Give all rail sections the same structure (heading, optional subtitle, rows at one height).

## 14. Home, mobile, both themes: the meta row baselines do not align
- **Where:** each project row, the "status / price / Updated" line (for example y ~230).
- **What is wrong:** "Updated 2 h ago" sits about 3 px higher than "$0.18" and "Waiting on you".
- **Why:** the misalignment is visible at arm's length on a line of three items.
- **Fix:** align the items on the baseline (`align-items: baseline`), and use the same font size for all three.

## 15. Home, mobile, both themes: the order hides the main action
- **Where:** "New project" starts at y ~720, below four project rows. "Latest findings" is below it.
- **What is wrong:** a user must scroll past all projects to start a new one. The findings list then sits under the form, which breaks the "status first" logic of the desktop page.
- **Fix:** put a compact "New project" button at the top that opens the composer, or move the composer above the project list.

## 16. Session, desktop, both themes: the header right side is unbalanced
- **Where:** y 32, x 910–1400.
- **What is wrong:** there is an 80 px gap between "Stop" and the avatar, and less than 20 px between all other items. "Running" sits about 2 px lower than "$0.94 spent".
- **Fix:** use one gap (16–24 px) and baseline alignment. Put the avatar after a vertical divider if it needs separation.

## 17. Session, mobile drawer, both themes: small drawer issues
- The title "Findings and files" leaves out the call tree, which the drawer also shows.
- "Close" is plain text, not a button. It has no clear tap area.
- A 1–2 px strip of the page shows at the left edge, so the drawer looks misplaced.
- **Fix:** title it "Project details". Use an icon button with a 44 px target for Close. Make the drawer full width, or leave a deliberate 48 px scrim strip.

## Verdict

I would not ship this. The parts are clean: one font, monochrome, consistent composer and tabs. But the three pages do not form one product. The landing page has a strong single image, and the app drops it for a plain template. The home page leaves half the screen empty on a laptop. The session page, which is the core of the product, has the most defects: clipped content in three scroll areas, a code block that hides its result on mobile, a header that takes 14 % of the phone screen, a Stop button that looks like navigation, and status dots that do not show that anything is running. Each item is a small fix. Together they make the product look unfinished. Fix items 1–9 before launch. Items 10–17 can follow in the next pass.
