# Visual review: landing, home, session

Method: Playwright screenshots at 1440x900 and 390x844, light and dark, plus 2x and 3x crops. I scrolled the inner scroll containers and opened the mobile "Findings" drawer. I did not read the source. Coordinates are CSS pixels.

Ranked from worst to least bad.

## 1. Mobile session opens with the newest answer hidden

- **Where:** session, 390, light and dark. Bottom of the thread, directly above the reply box (y about 740 to 770).
- **What is wrong:** The page loads scrolled to the start of the last turn. The screen shows "Thinking", the command output and "Recorded 2 findings". The actual reply ("It holds at n = 11, two terms past anything...") shows as one faded, half-cut line under the reply box.
- **Why it is wrong:** The reply is the most important text on this screen. The user sees the machinery and not the result. It also looks like a rendering fault.
- **Fix:** On load, scroll the thread so that the end of the newest reply sits directly above the reply box. Keep the fade, but stop it from covering the last line when the thread is at the bottom.

## 2. A faded band crosses the mobile Findings drawer

- **Where:** session, 390, light and dark. Open "Findings". Files list, second row, "results/fertility_n11.csv" (y about 790 to 805).
- **What is wrong:** One row is washed out and its top half is cut. The rows above and below are normal. The band stays at the same screen position. It looks like the thread fade above the reply box draws on top of the drawer.
- **Why it is wrong:** It reads as a bug. It also makes one file look disabled or deleted.
- **Fix:** Put the drawer above every layer of the session page, including the fade. Or hide the fade while the drawer is open.

## 3. Command output wraps on mobile and loses its columns

- **Where:** session, 390, both themes. Every "Ran" block, for example "$ python popstack.py --n 11".
- **What is wrong:** The output lines wrap with a hanging indent. "39,916,800 permutations 8,152,860" breaks, and "distinct images 2 min 41 s" goes to the next line. "yes" goes to its own line under "max preimage count at the identity".
- **Why it is wrong:** The output is a table made of spaces. When it wraps, the values detach from their labels and the evidence becomes hard to read.
- **Fix:** Use `white-space: pre` with horizontal scroll inside the block. Add a fade on the right edge to show that more content is there. Or reduce the mono size to about 12px on mobile.

## 4. Status markers have no single system

- **Where:** all app pages, both themes, both widths.
- **What is wrong:** The product shows status in at least six marker shapes and four layouts:
  - Projects (home): red dot, spinner, grey filled dot, hollow circle, each with a word.
  - Findings (home sidebar, session panel, thread): filled square, hollow square, dash.
  - Call tree (session panel): grey dot with "Finished".
  - "Started 3 agents" table in the thread: plain grey "Finished" with no marker.
  The session screen shows "Finished" with a dot (right panel) and "Finished" without a dot (thread) at the same time.
  "Confirmed" and "Open question" differ only by fill in an 8px square. At 1x they are almost the same.
- **Why it is wrong:** The user must learn several codes for one concept. The most important difference for a research product, confirmed or not, is the weakest signal on the page.
- **Fix:** Define one status component with one shape per state. Use it in all four places. Give "Confirmed" a different weight or colour from "Open question", not only a fill change.

## 5. Red means "error" but here it means "your approval is needed"

- **Where:** home, all widths and themes. First row, "Waiting on you".
- **What is wrong:** Red is the only colour in the product. It marks a project that waits for a spending approval.
- **Why it is wrong:** Users read red as failure or danger. A normal request then looks like an incident. Because no other colour exists, red also makes the status column shout louder than the project titles.
- **Fix:** Use an attention colour (amber, or a single brand accent) for "Waiting on you". Keep red for failures. Also show the action on the row (for example "Approve $2.40"), so that the colour is not the only signal.

## 6. The session thread has no clear hierarchy

- **Where:** session, 1440, both themes. Left column.
- **What is wrong:**
  - The final reply ("It holds at n = 11...", 16px, black) sits outside the indented "lumen" block. It has no label, so it looks like a separate, unattributed message.
  - The column uses three text widths: "Thinking" text wraps at about 540px, the reply at about 625px, and tables and code at 783px. The right edge is ragged.
  - The labels "Thinking", "Ran", "Searched", "Recorded 2 findings" are 12px bold. They are smaller than the body text they introduce.
  - "Saved a file ... 28 lines" ends about 16px before the right edge of the tables under it.
- **Why it is wrong:** The eye cannot find the start and end of one turn of lumen. The many widths make the column look unfinished.
- **Fix:** Put the reply inside the lumen block, under the trace, or give the trace a clear "Steps" disclosure and keep the reply as the block's main text. Use one text width for prose (about 640px) and one for tables and code (full column). Make step labels 13px medium in the muted colour, not 12px bold black. Align all right-side values to the same edge.

## 7. The mobile landing wastes the first screen

- **Where:** landing, 390, both themes. Between the sphere (ends at y about 270) and the headline (starts at y about 420).
- **What is wrong:** A band of about 150px is empty. The headline starts at about half the screen height. The input box sits near the bottom.
- **Why it is wrong:** On mobile the headline and input are the reason for the page. Empty space here only pushes them down.
- **Fix:** Reduce the gap to about 32px. Make the sphere smaller (about 160px), or put it behind or after the headline.

## 8. The light landing sphere overpowers the headline

- **Where:** landing, 1440 and 390, light.
- **What is wrong:** The sphere is drawn with dense black dots up to a hard right edge. It is the darkest and largest mass on the page, so the eye goes there first. In dark mode, the same sphere fades at the edge and looks soft. The two themes show two different objects.
- **Why it is wrong:** The headline and the input are the content. The decoration takes the attention. The theme difference makes the brand mark look unstable.
- **Fix:** In light mode, use smaller or lighter dots (a grey ink, not pure black), and let the dark side fade at the edge as it does in dark mode. Check both themes side by side for the same visual weight.

## 9. The header is different on every page and misaligned inside

- **Where:** all pages, both themes.
- **What is wrong:**
  - The landing header has no bottom rule. Home and session have one.
  - Session, 1440: the breadcrumb "Projects / Pop-stack fertility" sits about 4px lower than the "lumen" wordmark.
  - Session, 1440: "Running", "$0.94 spent", "2 h 14 min elapsed" and "Stop" are on slightly different baselines (y 30, 31, 31, 32).
  - "Stop" is a bold word with a square icon, next to metadata. It does not look like a button, and nothing separates it from the status text.
  - Session, 390: the header uses three rows and about 125px (15% of the screen). "Stop" ends at about x 352, not at the right margin (x 370) where the avatar ends.
- **Why it is wrong:** The header is the one element that must feel the same on every page. Small baseline errors make the whole product look loose. A destructive control that looks like a label is a risk.
- **Fix:** Use one header component with the same height, rule and baseline on all pages (the landing can drop the rule only if the app pages drop it too). Align all header text to one baseline. Make "Stop" an outlined button, the same style as "Findings" and "New project", with a gap before it. On mobile, put the breadcrumb and the status in one row, and align "Stop" to the right margin.

## 10. The landing is one screen with nothing under it

- **Where:** landing, 1440, both themes.
- **What is wrong:** The page ends at the fold. Below the input there are about 200px of empty space and one footnote, "lumen (lm), the SI unit of luminous flux." There is no footer, no product view, no example finding.
- **Why it is wrong:** The page asks the user to start a paid research agent, but it shows no evidence of what the agent produces. The empty lower third also makes the layout feel top-heavy.
- **Fix:** Add one section under the fold with a real finding card or a cropped session screenshot, built from the same components as the app. Add a minimal footer row (Docs, Pricing, Terms) in the muted style.

## 11. Home rows have a dead gap and unnecessary wraps

- **Where:** home, 1440, both themes. Projects list.
- **What is wrong:** The description stops at about x 635. The cost and "Updated" column starts at about x 700 to 780. About 100 to 150px stay empty in every row, and most descriptions wrap to two lines. The cost ("$0.18") is in the same weight and colour as the title, so each row has two focal points.
- **Why it is wrong:** The rows are taller than needed and the list holds fewer projects per screen. The cost competes with the title.
- **Fix:** Let the description run up to the meta column with a 32px gap. Show the cost in regular weight, in the foreground colour at 14px, and the date in the muted colour.

## 12. The desktop thread is cut hard at both ends

- **Where:** session, 1440, both themes. Thread top (under the header rule) and thread bottom (above the reply box, y about 780).
- **What is wrong:** When the thread scrolls, text is cut in mid-line against the header rule and against the reply box, with about 20px of space and no fade. Mobile has a fade at the bottom; desktop does not.
- **Why it is wrong:** Hard cuts look accidental. The two widths behave differently.
- **Fix:** Use the same bottom fade on both widths, and add 16 to 24px padding at the top of the scroll area.

## 13. Small alignment errors in status labels

- **Where:** home, 1440, both themes; session, both widths.
- **What is wrong:**
  - "Running" starts about 3px to the right of "Finished" and "Stopped", because the spinner is wider than the dots. "Running" is also black while the other states are grey.
  - "Dropped" (home sidebar, last finding; session thread, "Tunnels on Dyck paths") sits about 5px lower than the title. "Confirmed" and "Open question" align with the title.
- **Why it is wrong:** The status column is a vertical scan line. Small shifts break it.
- **Fix:** Give every status icon the same fixed box (for example 12x12) and centre the icon in it. Align all badges to the first line of the title.

## 14. The background dot texture is patchy

- **Where:** landing, home main column, session thread; light and dark. Best seen at 2x.
- **What is wrong:** A faint dot grid covers the background. At 1x it is almost invisible. Where it is visible, it shows only in gaps between blocks, because blocks with solid backgrounds hide it. The grey side panels do not have it.
- **Why it is wrong:** A texture that appears in some gaps and not in others looks like a defect, not a decision.
- **Fix:** Use the texture only on the landing, where it supports the halftone sphere. Remove it from the app pages.

## 15. Link styles do not agree

- **Where:** session, 1440 and 390, both themes. "Show all 5" in the Findings panel.
- **What is wrong:** "Show all 5" is the only underlined link. "Docs", "Sign in" and "Projects" are links without underlines.
- **Why it is wrong:** The user cannot predict which text is clickable.
- **Fix:** Choose one rule. For example: navigation links have no underline, inline and "show more" links use the muted colour with underline on hover.

## 16. Mobile home has two "new project" entry points far apart

- **Where:** home, 390, both themes.
- **What is wrong:** An outlined "New project" button sits at the top right of the list. The actual "New project" composer sits under all seven projects, about one screen and a half lower. The budget in the header loses "this month" and reads "$2.02 of $200" with no period.
- **Why it is wrong:** The button and the section have the same name but appear as two different things. The budget has no time frame.
- **Fix:** Put the composer at the top of the mobile page, above the projects, and remove the button. Or make the button open the composer in a sheet. Keep "/mo" after the budget.

## 17. Type sizes step too finely

- **Where:** all pages.
- **What is wrong:** I count at least 12, 13, 14, 15, 16 and 18px in the app pages, with weights 400, 500 and 600. Section headings (18px, "Projects", "Findings", "Call tree") are close to item titles (15px semibold). The step from 18 to 56 on the landing has nothing between.
- **Why it is wrong:** Steps of 1px are not visible as levels. They look like errors and do not build hierarchy.
- **Fix:** Use four app sizes: 12 (labels), 14 (body and meta), 16 (titles and reply), 20 (section headings). Use two weights: 400 and 600.

## 18. Small mobile details

- **Where:** session, 390, both themes.
- **What is wrong:**
  - The full-width drawer has a 1px rule on its left edge, at x 0.
  - The helper text under the reply box ("lumen keeps working while you write...") is on desktop but not on mobile.
- **Why it is wrong:** The edge rule has nothing to separate. The missing helper text changes the meaning of the reply box between widths.
- **Fix:** Remove the drawer's left rule at full width. Show the helper text on mobile in 12px, or remove it on both widths.

## Verdict

I would not ship this as it is. I would ship it after a short pass. The base is good: one typeface, a strict grey scale, the same composer and tab component on all three pages, and the same two-column split on home and session. Light and dark agree almost everywhere. The problems are in execution, not in direction. Three of them block release: the mobile session hides the newest reply, the mobile drawer shows a washed-out band, and mobile command output loses its columns. Those make the primary screen look broken on a phone. After that, the most important fix is one status system with a clear difference between "Confirmed" and "Open question", and a non-red colour for "Waiting on you". The header, thread hierarchy, landing spacing and alignment items are a day of polish. Without them the product looks careful in its parts but not yet like one finished object.
