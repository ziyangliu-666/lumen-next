# First-time comprehension review: landing, home, session

Method: Playwright with headless Chromium, viewport 1440x900, `prefers-color-scheme` light and dark. I judged only the pixels and what happened when I clicked, hovered, typed and scrolled. I did not read the source. All three pages are exactly 900 px high. On the session page, the conversation column and the right column scroll as separate panes.

Light and dark use the same layout and the same hierarchy. Only the colours invert. Unless I name a scheme, a finding applies to both.

---

## 1. Landing (`landing.html`)

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| L1 | Top left, "lumen" | Wordmark | Brand; probably a link to this page | sure |
| L2 | Top right, "Docs", "Sign in" | Top navigation | Documentation; sign-in for existing users | sure |
| L3 | Left, about y 260-420, "Now you can do any frontier work. Just start." | Headline. The third line is grey. | Sells the product | sure about the role; guessing about why "Just start." is grey (secondary? disabled? a placeholder?) |
| L4 | Under the headline, two lines of grey body text | Product description: "a research agent for mathematics" | Tells me what the product does | sure |
| L5 | "Free exploration" / "From a starting point" | Two tabs, or a segmented choice | Selects the mode for the input under them | guessing. They are plain text with an underline under one. They could also be links to two pages. |
| L6 | Input with "Name a field of mathematics, or leave it open", "Attach", and a black arrow button | Prompt box | Starts a research run directly from the landing page | sure that it is an input. No idea whether it starts a real paid run without sign-in. |
| L7 | Small grey line under the input, "lumen picks its own question and reports back." | Helper text for the current mode | Explains Free exploration | guessing. It is very small and light, so it reads as legal fine print. |
| L8 | Right half, large halftone dot sphere. In light mode it has a dotted ellipse under it. | Decorative illustration (a "lumen", a light source) | Atmosphere only | guessing. It could also be a loading or status visual. |
| L9 | Bottom left, "lumen (lm), the SI unit of luminous flux." | Footnote about the name | Explains the name | sure |

### 1.2 What was hard to tell apart, and what had the wrong weight

- **L8 against everything else.** The sphere takes about half the viewport and has the highest contrast on the page. The prompt box (L6) is the only thing a user can act on, and it takes about 550x50 px. The eye goes to the decoration first and to the action second.
- **L3 line 3 against L4.** "Just start." uses the same grey family as the body copy. Grey usually means secondary or inactive. Here it is the call to action. The screen does not say which one it is.
- **L5 against L2.** The mode tabs and the top-right navigation use the same weight, size and colour. Nothing marks L5 as a control that changes L6. It looks like a second navigation row.
- **L7 against L9.** The two helper lines use the same tiny grey style. One describes a mode that I need to understand before I submit. The other is trivia about the name. They look equally unimportant, and L7 is not.
- **"Attach" against the arrow.** Both sit inside the input. "Attach" is a text button and the arrow is a filled black block. That part is clear. It is not clear what can be attached, or whether "Attach" works in Free exploration, where there is no starting point to attach.
- **Light against dark.** In light mode the sphere has a dotted "shadow" ellipse. In dark mode the ellipse is not there. The two images do not look like the same object.

### 1.3 After interaction: which guesses were wrong

- **L5 tabs:** my guess was correct. Clicking "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and the helper to "lumen starts from what you give it." The URL does not change. The guess was correct only because I clicked. The static screen gave no sign of it.
- **L8 sphere: wrong.** It is not static. The lit side of the sphere follows the mouse pointer, and the dotted ellipse moves to the opposite side. When the pointer is on the left column, the sphere lights from the left. So the largest element on the page reacts to the pointer and does nothing else. A first-time user will try to click it. A click does nothing.
- **L6 submit: wrong in a way that matters.** With no sign-in, the arrow opens `session.html?mode=free&q=...` at once. The session header says "Running", "$0.00", "just started". An anonymous visitor appears to have started a run. An empty submit also starts a run. The user turn then reads "No field given. lumen chooses." in the "You" row, which puts words in the user's mouth that the user did not type.
- **New run: no progress.** After 10 s the run still shows one "Thinking" block, "just started" and $0.00. The "Running" dot pulses, but nothing else changes. The page says "Running" and shows no sign of work.
- **L2 "Docs": wrong.** It goes to `#`. It is a dead link.
- **L2 "Sign in": wrong.** It goes straight to `home.html` with no form. That is acceptable for a mock-up. It means the screen does not show what sign-in costs the user.
- **"Attach":** opens a native file picker. Nothing on screen says which file types are accepted.
- **L1 wordmark:** reloads the landing page. As expected.
- **Focus:** a focused input gets a double black outline. That is clear.

---

## 2. Home (`home.html`)

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| H1 | Top bar, "lumen" on the left, a full-width black rule under the bar | App header | Brand and home link | sure |
| H2 | Top right, "$1.55 of $200 this month" | Spend against a monthly budget | Shows cost | sure about the meaning. No idea whether $200 is a cap I set, a plan limit, or a credit. |
| H3 | Top right, square box "LZ" | Account avatar or menu | Account settings, sign-out | guessing. It is a square with initials and has no affordance. |
| H4 | Left gutter, "New project" | Section label | Names the row on its right | sure |
| H5 | Tabs, input, Attach, arrow, helper text | The same prompt box as the landing page | Starts a new project | sure |
| H6 | Left gutter, "Projects 4" | Section label with a count | Names the list | sure |
| H7 | Four rows: title, status tag, one or two lines of summary, cost on the right, "Updated ..." | Project list | Opens a project and shows its state | sure |
| H7a | Red dot plus "Waiting on you" on row 1. The first part of its summary is darker. | Needs-attention status | Tells me to act | sure |
| H7b | Black dot plus "Running" on row 2 | Active status | Info | sure |
| H7c | "Finished" and "Stopped" in plain grey | Ended statuses | Info | sure about the meaning. The two words look identical, but they mean different things. |
| H8 | Large empty area under the list, about 280 px | Empty space | Nothing | sure |

### 2.2 What was hard to tell apart, and what had the wrong weight

- **H4/H6 labels against H7 content.** The left-gutter labels are grey, small and light. They look like metadata, not section headers. "Projects 4" reads as a filter or a count chip, not as "your projects".
- **"Finished" against "Stopped".** Both are grey text with no dot. "Finished" means lumen completed the work. "Stopped" means I killed it. These are opposite outcomes, and the screen gives them the same weight. "Stopped" is in fact worth a glance: the row says the result "is already in Gessel and Seo, 2006", so the work was a duplicate.
- **Cost column against title column.** Each row's cost ($0.18, $0.94) is black and medium weight, the same weight as the project title. "Updated 2 h ago" is grey. So the cost competes with the title for attention. For a list of research projects, the cost is the least important fact per row. The summed spend is already in H2.
- **Row 1 summary: two greys in one paragraph.** "Asks to spend about $2.40 more to extend the count to n = 14." is darker, and the rest is grey. The difference is too small to read as "this is the action". It reads as a rendering accident.
- **No action on row 1.** "Waiting on you" is the only state that needs me, but the row has no button. I must guess that I click the title, then find the request inside.
- **H5 against H7.** The new-project input is at the top, full width, with a black button. The red "Waiting on you" row sits below it. For a returning user, the open request matters more than a new project. The layout ranks them the other way round.
- **H3.** A square outlined box is the same shape as the tags in the session page ("Open question"). The screen does not say whether it is a button.

### 2.3 After interaction: which guesses were wrong

- **H7 rows: correct.** On hover, a row gets a grey fill and its title is underlined. A click opens `session.html?p=<id>`. The hover fill extends about 16 px further left than the text column. It is a small misalignment, but you can see it.
- **H3 "LZ": wrong.** A click goes to `#`. No menu opens. It is not a working control.
- **H2 budget: no interaction.** Hover shows no tooltip and a click does nothing. What "of $200" means stays unknown.
- **H4/H6 labels:** they do nothing when I click them. As expected.
- **State does not carry over.** I approved the $2.40 request in the Inversion session and then returned to home. Row 1 still said "Waiting on you" with the same text. A first-time user will think the approval failed.

---

## 3. Session (`session.html`, default project "Pop-stack fertility")

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| S1 | Header left: "lumen", then "Projects / Pop-stack fertility" | Breadcrumb | Navigation back to the list | sure |
| S2 | Header right: dot "Running", "$0.94", "for 2 h 14 min" | Run status, cost, duration | Shows the live state of the run | sure about status and cost. Guessing about "for 2 h 14 min": total run time? time since last activity? |
| S3 | Header far right: "LZ" box | Account | As on home | guessing |
| S4 | Left gutter: "lumen", "You", "lumen" | Speaker labels | Shows who wrote each turn | sure. The top "lumen" label is grey and the others are black. I could not tell why. |
| S5 | Main column, first paragraph ("Three of the four lines are already solved...") | lumen's message | Narrative of progress | sure. The paragraph starts mid-thought, so I did not know that the pane had opened scrolled to the bottom. |
| S6 | "You: Push it to n = 11 before you trust the conjecture." | My earlier instruction | History | sure |
| S7 | Indented block with a thin left rule: "Thinking", "Ran 2 min 41 s", a grey code box, "Recorded 2 findings" with tags | Agent activity trace | Shows what the agent did as steps | sure |
| S8 | The paragraph after S7 ("It holds at n = 11...") | lumen's conclusion for the turn | Summary | sure |
| S9 | Bottom of the main column: "Reply to lumen", Attach, arrow, and "lumen keeps working while you write. It reads your message at its next step." | Reply box | Steer the agent | sure |
| S10 | Right column, grey panel, "Findings 5 / What lumen has checked, newest first." Three cards with tags "Open question" (outlined) and "Confirmed" (filled grey). "Show all 5". | Results ledger | The output of the research | sure about the idea. Guessing about the tags: is "Open question" a button that opens something? |
| S11 | Right column, "Call tree / The lead agent and the agents it started." lead = Running; reader, compute-perm, compute-dyck = Finished | Sub-agent list | Shows parallel workers | sure |
| S12 | Right column, "Files 7", a monospace list of paths. The list fades out at the bottom edge. | Workspace files | Opens the artifacts | guessing that they are clickable. The list is cut off with no scroll hint other than the fade. |

### 3.2 What was hard to tell apart, and what had the wrong weight

- **S7 "Recorded 2 findings" against S10 Findings.** The same findings, with the same titles and the same tags, appear in two places on one screen. The screen does not say that they are the same records. On a first read they look like a second, different set.
- **The tag set has three visual styles for one variable.** "Open question" is an outlined box, "Confirmed" is a filled grey box, and "Dropped" (seen after "Show all") is plain grey text with the title struck through. The outlined box looks like a button. The filled box looks like a disabled button. Neither is a button.
- **S2 "Running" against S11 "lead Running".** These are the same status in two places with the same dot. The page does not say whether they can differ. They can differ: see 3.3.
- **"Thinking" text against tool output.** "Thinking" body text is grey. The final message (S5, S8) is black and larger. That part works. But the "Searched" table and "Started 3 agents" table use black for their middle column and grey for their first column. This makes the tool rows look more important than the thinking, which is the reverse of the text hierarchy one level up.
- **The code box against the panels.** The "Ran" output box uses the same grey as the right-hand panel background. In light mode the code box and the right panel read as the same kind of surface.
- **The right column has no internal hierarchy.** Findings, Call tree and Files have identical headers. Findings is the product's output. Call tree is a debugging detail. They get equal weight, and Findings are long cards while Call tree rows are compact. So the order of importance is set by length only.
- **The reply box promises behaviour that the screen cannot show.** "lumen keeps working while you write. It reads your message at its next step." This is the most important rule for this page, and it is the smallest and lightest text on it.
- **S2 "for 2 h 14 min".** The time is grey and has no label. On other projects the same position shows "waiting for 2 h" or "yesterday, after 1 h 05 min". The meaning changes with the state, and nothing tells me which meaning is on screen.

### 3.3 After interaction: which guesses were wrong

- **S5 start point:** the conversation pane opens scrolled to the bottom. When I scrolled up, the first turn appeared: "You: Act as an independent researcher..." The grey "lumen" label at the top of the gutter is a sticky label for a turn whose start is above the fold. That explains the grey colour. Nothing on screen explained it before I scrolled.
- **S10 Findings cards: wrong.** I guessed that a click would open the finding or jump to where it was recorded. A click on a title, a body or a tag does nothing. No hover state appears either.
- **"Open question" and "Confirmed" tags: wrong.** They look like buttons. They are not. A click does nothing and no tooltip appears.
- **"Show all 5": correct, with a defect.** It expands two more findings: "3-stack-sortable is A134664, not A000139" (Confirmed) and "Tunnels on Dyck paths" (Dropped, struck through). The link then disappears, and no "Show fewer" link replaces it. The panel pushes Call tree and Files down below the fold.
- **S11 Call tree rows: wrong.** I guessed that "compute-perm" would open that agent's trace or filter the conversation. A click does nothing.
- **S12 Files: wrong.** A click on a file path does nothing. The paths look like links (monospace, a list of artifacts). Inline file names in the conversation ("code/popstack.py") and in the findings ("research/proof-sketch.md") do nothing too.
- **S2 status:** a click does nothing. Hover shows no tooltip.
- **S9 reply: correct.** Enter sends. The message appears as a "You" turn with "Queued. lumen reads it at its next step." under it. After 8 s it was still queued, and lumen did not answer.
- **S1 "Projects": correct.** It goes back to home.

**Other projects, opened from home:**

- **Inversion (Waiting on you).** The request is a card in the main column with a red left rule: "Spend about $2.40 more to extend the count to n = 14?", "Approve $2.40", "Not now". This is clear and it is the best region on any of the three pages. It is not shown on home and it is not in the header. You must scroll the conversation to find it.
  - **Approve:** a "You: Approved: spend about $2.40 on n = 13 and 14." turn appears, and lumen thinks "Running n = 13 now." The header changes to "Running", "for 2 h 01 min". The cost stays $0.18. Home still shows "Waiting on you" afterwards.
  - **Not now: state is inconsistent.** The header changes to "Running" with "waiting for 2 h". The Call tree still shows "lead: Waiting on you" in red. lumen says "I will stop at n = 12 and write up...". So one screen shows three states at the same time: running, waiting and stopping.
- **Pinnacle (Finished).** The header says "Finished", "yesterday, after 1 h 05 min". The reply box still says "lumen keeps working while you write. It reads your message at its next step." That is false for a finished run, and the screen does not say what a reply to a finished project does.

**Dark mode, session:** the hierarchy is the same. The red "Waiting on you" and the red rule on the approval card have enough contrast. The filled "Confirmed" tag becomes dark grey on black and is harder to read than the outlined "Open question" tag. So in dark mode the confirmed result looks weaker than the open one.

---

## 4. Problems that affect all three pages

1. **Many things look clickable and are not.** Tags, findings, call-tree rows, file paths, the budget, "LZ" and "Docs" all look like controls. Only the rows on home, the tabs, "Show all", the approval buttons and the inputs do something. A first-time user will learn that clicking here mostly does nothing.
2. **One status, several places, no single source.** Header, call tree, home row and conversation each show a run state. After "Not now" they disagree. After "Approve", home disagrees.
3. **Helper text carries the rules, and it is the faintest text on screen.** Examples: "lumen picks its own question", "lumen keeps working while you write", "What lumen has checked, newest first". Each one explains behaviour that the user cannot infer, and each one is about 12 px light grey.
4. **The two mode tabs never explain the difference before you click.** You must toggle them to read the second helper line.
5. **A user can start a run with no sign-in and no confirmation, and an empty input also starts a run.** The landing page gives no sign that this costs money. The home page shows a monthly dollar budget on the first screen.
