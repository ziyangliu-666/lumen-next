# First-time comprehension review: landing, home, session

Method: Playwright screenshots at 1440x900, light and dark color scheme. Then clicks, hovers, typing, scrolling, and reloads. I judged only what is on screen. I did not read source.

---

## 1. Landing (`landing.html`)

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| L1 | Top left | "lumen" wordmark | Brand, maybe a home link | Sure |
| L2 | Top right | "Docs", "Sign in" text links | Navigation | Sure |
| L3 | Left, upper middle | Headline "Now you can do any frontier work. Just start." The last line is grey | Marketing claim | Sure about what it is. The grey line looks disabled or secondary, and I cannot tell why. |
| L4 | Under headline | Two-line paragraph | Says what the product is: a research agent for mathematics | Sure |
| L5 | Above input | "Free exploration" / "From a starting point" with an underline under the first | Two modes for the input | Guessing. They look like plain text links, not like tabs. |
| L6 | Left, middle | Text field, "Attach", black arrow button | Start a research run | Sure |
| L7 | Under input | Small grey helper line, "lumen picks its own question and reports back. You sign in first." | Explains the mode. Warns that sign-in comes next. | Sure |
| L8 | Right half | Large halftone dot sphere | Decoration, maybe the "light" brand idea | Guessing |
| L9 | Under sphere, light mode only | Flat dotted ellipse | Shadow or reflection. It could also be a second object, such as a plate. | Guessing |
| L10 | Bottom left | "lumen (lm), the SI unit of luminous flux." | Name explanation | Sure about the text. Its position makes it read as a legal footer or an image caption. |
| L11 | Whole background | Very faint dot grid | Texture | Guessing. It is almost invisible in light mode. |

### 1.2 What I could not tell apart, false equal weight, and why

- **The sphere outweighs the only action.** It fills half the screen at full contrast. The input is a thin 50 px strip. The eye goes to the decoration first, then to the headline, and last to the input.
- **The mode switch (L5) does not look like a control.** It is the same size and weight as body text. Only a 2 px underline marks the active option. I could not tell before clicking that it changes the input.
- **"Docs" and "Sign in" have identical weight.** Sign in is the account entry point, but it is styled the same as a docs link.
- **"Just start." is grey.** On a page where grey also means "secondary helper text" (L7, L10), the grey headline line reads as de-emphasised or disabled.
- **The helper line (L7) and the footnote (L10) have the same small grey style.** One is an operational warning ("You sign in first"). The other is trivia. They look equally (un)important.
- **Light and dark differ in content.** The ellipse under the sphere (L9) exists only in light mode. In dark mode the sphere has a bright highlight. In light mode the same highlight renders as sparse white dots, so it reads as a hole or a dent in the sphere, not as light.

### 1.3 After interaction: wrong guesses

- **L5 tabs: guess correct.** "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and changes the helper line.
- **L8 sphere: guess partly wrong.** It reacts to the pointer. The highlight moves toward the cursor (pointer at bottom right moves the light to bottom right). Nothing on screen says it is interactive. Because the light-mode highlight looks like a hole, the effect reads as a glitch.
- **L6 Attach: correct.** It opens a file chooser.
- **L7 "You sign in first": wrong, or the screen lies.** Enter or the arrow goes straight to the Home page. No sign-in step appears. Home then says "You are signed in. Press the arrow to start." I must press the arrow a second time. An empty field also submits and goes to Home.
- **L2 "Sign in": wrong.** It goes straight to Home with no form.
- **L2 "Docs": dead.** The link goes to `#` and nothing happens.
- **Scroll: nothing.** The page has no more content.

---

## 2. Home (`home.html`)

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| H1 | Top left | "lumen" wordmark | Home link | Sure |
| H2 | Top right | "$1.55 of $200 this month" | Spend so far against a monthly cap | Sure about the meaning. I do not know whether $200 is a hard limit or a budget alert. |
| H3 | Top right corner | "LZ" in a square box | Account avatar or account menu | Guessing |
| H4 | Left column, heading | "Projects 4" | List heading with a count | Sure |
| H5 | Left column, first sub-column | Status with dot: red "Waiting on you", black "Running", grey "Finished", hollow "Stopped" | Project state | Sure about "Waiting on you" and "Running". Guessing about the difference between "Finished" and "Stopped". |
| H6 | Left column, middle sub-column | Bold title plus a two-line summary | Project name and its latest state in prose | Sure |
| H7 | Left column, right sub-column | "$0.18" in bold and "Updated 2 h ago" | Cost per project and last activity | Sure |
| H8 | Right panel (grey background), top | "New project", the two mode options, the input, the helper line | Start a new project. It is the same control as on the landing page. | Sure |
| H9 | Right panel, below | "Latest findings" list: title, "project, time" line, badge "Open question" (outlined) or "Confirmed" (grey fill) | Recent results across all projects | Sure about the list. Guessing about what the badges mean, and whether the items are clickable. |

### 2.2 What I could not tell apart, false equal weight, and why

- **"Finished" and "Stopped" look almost the same.** Both are grey text. One has a small filled grey dot, the other a small hollow dot. At 8 px the difference is near invisible. In dark mode, "Running" (white dot) and "Finished" (light grey dot) are also close.
- **The cost (H7) is as loud as the title.** "$0.18" is bold, black, and the same size as the project title. A few cents per project gets the same visual rank as the project name, and more rank than the status.
- **The badges invert their weight.** "Open question" has a black outline and looks like a button. "Confirmed" is a low-contrast grey chip and looks disabled. The weaker result looks more important and more clickable than the stronger one. In dark mode the "Confirmed" chip is dark grey on near-black, so it almost disappears.
- **"Latest findings" sits in the same grey panel as "New project".** The panel reads as one unit. A first-time user can read the findings as belonging to the new project or as example output.
- **The findings duplicate the project rows.** "Counts to n = 12 match no OEIS sequence" appears as a project summary on the left and as a finding on the right. Nothing on screen says how the two relate.
- **H3 "LZ" has the same outlined-box style as the badges and the Stop button on the session page.** Status labels, actions, and identity all share one box style.

### 2.3 After interaction: wrong guesses

- **Project rows: correct.** Hover gives a grey band and an underlined title. A click anywhere on the row, including the status, opens that project's session.
  - Defect: the hover band runs about 16 px past the right end of the row divider. The band is asymmetric.
- **Cursor halo: not visible before interaction.** The pointer reveals a halftone dot spotlight that follows it. The halo bleeds across the header bar and across region borders. On first sight it looks like a rendering artifact, not a decoration.
- **H9 findings: guess wrong.** I expected a click to open the finding. A click opens the parent project's session at its default scroll position. The finding is not shown, highlighted, or scrolled to.
- **H9 badges: no help.** Hover gives no tooltip. Nothing explains "Open question" or "Confirmed".
- **H2 spend: not interactive.** It has no breakdown and no link.
- **H3 "LZ": guess wrong.** It is not a menu. A click goes to `#` and nothing opens.
- **H8 New project: correct.** Text plus Enter creates a session. The raw input, "Catalan objects", becomes the project title in the breadcrumb.
- **State carries across pages, but only for some actions.** "Not now" on a session changed the home row to "Running" and the summary to "You said not now…". "Stop" did not carry across. See 3.3.

---

## 3. Session (`session.html`, Pop-stack fertility)

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| S1 | Top left | "lumen / Projects / Pop-stack fertility" | Breadcrumb back to Home | Sure |
| S2 | Top centre-right | "● Running  $0.94  for 2 h 14 min  [Stop]" | Run state, spend, elapsed time, stop control | Sure about state and Stop. Guessing about "$0.94 for 2 h 14 min": it reads like a price for a duration. |
| S3 | Top right | "LZ" | Account | Guessing |
| S4 | Left column, top | A faded "lumen" label, cut under the top bar, then a black paragraph | The middle of an earlier agent message. The page opens scrolled to the bottom. | Guessing at first. The faded label looked like a rendering error. |
| S5 | Left column | "You" plus a grey filled box | My earlier message | Sure |
| S6 | Left column | "lumen" plus an indented block with a thin left rule: "Thinking" (grey text), "Ran 2 min 41 s" (code box), "Recorded 2 findings" (rows with badges) | The agent's working trace for this turn | Sure about the trace. Guessing about the scope of the left rule. |
| S7 | Left column, below trace | Black, larger, unindented paragraph | The agent's reply to me | Sure |
| S8 | Left column, bottom | "Reply to lumen" input, Attach, arrow, and the helper line "lumen keeps working while you write…" | Send a message to the running agent | Sure |
| S9 | Right panel, top | "Findings 5", subtitle "What lumen has checked, newest first.", three items with badges, "Show all 5" | The results list for this project | Sure |
| S10 | Right panel, middle | "Call tree": "lead" plus three indented rows (reader, compute-perm, compute-dyck) with status | Agents and their sub-agents | Guessing. The 16 px indent hardly shows a tree. |
| S11 | Right panel, bottom | "Files 7", a monospace grey list. The last three rows look faded, and `code/stacksort.py` looks cut through the middle like strikethrough. | Files the agent wrote | Sure about the list. I guessed that the faded or struck rows were deleted or obsolete files. |

### 3.2 What I could not tell apart, false equal weight, and why

- **Stop looks the same as a status badge.** "Stop" is a small black-outlined box with small text. "Open question" is the same box. The one destructive control on the page has the same visual identity as a passive label.
- **The Files list has a false strikethrough.** A fade band at the bottom of the viewport cuts `code/stacksort.py` through the middle. It looks exactly like the strikethrough that marks a "Dropped" finding. This band appears in both light and dark mode.
- **Transcript findings and panel findings look like two different things.** "Recorded 2 findings" rows (S6) and the Findings panel (S9) show the same items with the same badges. Nothing says they are one object until a click links them.
- **"Started 3 agents" in the transcript duplicates the Call tree.** After scrolling up I found a table with reader, compute-perm, and compute-dyck, each "Finished". The Call tree repeats it. Both have equal weight.
- **"Running" appears twice.** It shows in the header (S2) and on "lead" in the Call tree. I could not tell whether they can differ.
- **The time slot changes grammar by state.** "for 2 h 14 min" (running), "waiting for 2 h" (waiting), "yesterday, after 1 h 05 min" (finished), "3 days ago, after 40 min" (stopped). The slot has the same position and style but carries four meanings.
- **Search tables have no column headers.** "OEIS | A262494, stack-sorting depth | Named, no recurrence". I had to guess that the columns are source, query, and result.
- **The opening view hides the user's original request.** The page loads scrolled to the end. The first visible line is the faded, cut "lumen" label. No control jumps to the start.
- **The right panel is uniform.** Findings, Call tree, and Files have the same heading style and spacing. The findings are the product's output. The call tree and files are plumbing. They look equally important.
- **Dark mode lowers the separation.** The right panel is dark grey on a black page. The code box borders and the row dividers almost disappear.

### 3.3 After interaction: wrong guesses

- **S4: wrong.** The faded label is a fade mask at the top of the scroll area, not an error. Scrolling up shows the full history. That history includes the original prompt, a search table, "Started 3 agents", and more "Thinking" blocks.
- **S11 faded and struck files: wrong.** After I scrolled the right panel, `code/popstack.py` and `code/stacksort.py` render normally. The look came from clipping, not from file state.
- **S11 files: not clickable.** A click does nothing. Escape does nothing.
- **S10 call tree rows: not clickable.** I guessed they open each agent's log. They do not.
- **S9 "Show all 5": correct, with a label problem.** It expands in place and shows two more findings, including "Tunnels on Dyck paths" with strikethrough and a "Dropped" badge. The toggle then reads "Show the newest 3". The header says "Findings 5", but the default view shows 3 with no "3 of 5" hint.
- **S9 finding click: partly correct.** It highlights the matching row in the transcript with a grey band. The band runs past the column edge. The reverse direction does not work: a click on a transcript finding row does nothing.
- **Badge hover: no explanation.** Hover underlines the finding title, so the badge is part of the link. No tooltip explains the badge.
- **S2 Stop: dangerous, and the result does not persist.**
  - Stop acts on the first click with no confirmation.
  - It adds "You: Stop." and "lumen: Stopped. I stopped at your request." The header changes to "○ Stopped".
  - After a reload, the session shows "Running" again. Home still shows "Running".
  - A user cannot tell from the screen whether the stop took effect.
- **S8 reply: correct.** The message appears with "Queued. lumen reads it at its next step."
- **Approval card (Inversion sequences project): correct, with a header problem.** The red-ruled card "Spend about $2.40 more…" has "Approve $2.40" and "Not now". Either button replaces the card with a "You:" message. The header changes from "Waiting on you $0.18 waiting for 2 h" to "Running $0.18 for 2 h 01 min". The number now means a different thing, and nothing on screen says so. The approve and not-now results persist across reloads and reach Home. Stop does not.
- **S1 breadcrumb: correct.** "Projects" goes to Home.

---

## 4. Cross-page problems

1. **One outlined-box style carries four roles.** These are: status badges ("Open question", "Dropped"), a destructive action ("Stop"), identity ("LZ"), and a mode-switch-adjacent button. A user cannot tell label from control.
2. **Grey carries too many meanings.** These are: secondary text, disabled-looking headline text, "Finished" status, "Confirmed" chip, agent "Thinking", file names, and fade masks. Because grey is everywhere, it cannot signal anything.
3. **Decorative effects look like defects.** These are: the cursor halftone halo that bleeds over the header, the light-mode sphere highlight that reads as a hole, the top fade that cuts the "lumen" label, and the bottom fade that strikes through a file name.
4. **Dead or misleading controls.** "Docs" (`#`), "LZ" (`#`), "Sign in" (no sign-in), the helper text "You sign in first" (no sign-in step), Files and Call tree rows (look like list items, do nothing), and Home findings (open the project, not the finding).
5. **State persistence is inconsistent.** Approve and Not now persist across reloads and pages. Stop does not.
