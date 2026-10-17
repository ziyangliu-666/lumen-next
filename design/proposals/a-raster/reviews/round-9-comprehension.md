# First-time comprehension review: landing, home, session

Method: Playwright, chromium headless shell, 1440x900, light and dark color scheme. I judged only what was on screen. I did not read the page source or any other file.

The light and dark schemes have the same layout and the same regions on all three pages. Where the dark scheme changes how a region reads, I say so under that region.

---

## 1. landing.html

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| L1 | Top left | Logo: a small dot-grid square and the word "lumen" | Product name. Possibly a link to this page. | Sure (name). Guessing (link). |
| L2 | Top right | "Docs" and "Sign in" text links | Documentation, and the sign-in for existing users | Sure |
| L3 | Left, upper half | Headline: "Now you can do any frontier work. Just start." The last line is grey. | Marketing claim | Sure |
| L4 | Left, under the headline | Two-line description: "lumen is a research agent for mathematics..." | Tells me what the product is | Sure. This is the only text that says what lumen is. |
| L5 | Left, middle | Two text labels: "Free exploration" (underlined) and "From a starting point" | Tabs that switch the input mode | Guessing. They look like plain text with an underline, not like tabs. |
| L6 | Left, middle | Text field "An area of mathematics, or none", an "Attach" button with a paper clip, a black square arrow button | Start a research run. Attach a file. Submit. | Sure (field, arrow). Guessing (what "or none" means, what files Attach accepts). |
| L7 | Under the field | Small grey line: "lumen picks its own question and reports back. You sign in first." | Explains free exploration, and warns that sign-in comes before the run | Sure |
| L8 | Right half | Large halftone sphere made of dots, lit from one side | Decoration, maybe the brand mark at large size | Guessing. It has no label and no relation to the text. |
| L9 | Whole background | Very faint dot grid | Texture | Guessing. I saw it only on close inspection. |
| L10 | Bottom left | Tiny grey line: "lumen (lm), the SI unit of luminous flux." | A footnote about the name | Sure about the text. No idea why it is there. It reads like a footer, but it has no links. |

### 1.2 What was hard to tell apart, and what had the wrong weight

- **The sphere (L8) has as much visual weight as the headline and the input together.** It takes the full right half of the screen, and it is the darkest mass in light mode and the brightest mass in dark mode. It does nothing and it says nothing. The eye goes to it first, then has to come back left to find the only control on the page.
- **The input (L6) is small for the only action on the page.** It sits under the headline and the description at the same left edge, in the same width as the paragraph. The black arrow button is the one high-contrast control, but it is 48 px wide.
- **The two tabs (L5) look like captions.** They have no box, no background, and a 1 px underline. "From a starting point" in grey reads as a disabled label, not as a second option. Nothing on screen tells me that the two modes are different until I click one and the placeholder changes.
- **"Free exploration" and "From a starting point" have no visible difference in meaning on first view.** The helper line explains only the selected mode. I must click to learn what the other mode does.
- **L7 and L10 have the same size and the same grey.** The sign-in warning and the SI-unit footnote look like the same kind of text. One is an instruction that changes what happens when I press the arrow. The other is trivia.
- **"Just start." is grey.** On this page, grey also means "secondary" (L4, L7) and "inactive" (L5). The headline uses the same colour for emphasis. That makes the grey signal ambiguous across the page.
- In dark mode the sphere is lit with white dots on black. It is brighter than the headline. The dominance problem is worse in dark mode.

### 1.3 After interaction: which guesses were wrong

- **"You sign in first" is false.** I pressed the arrow with an empty field. The page went straight to home.html, already signed in as "LZ", with seven existing projects. I typed "pattern avoidance" and pressed Enter: same result. No sign-in screen appeared at any point. The text in L7 promises a step that does not exist.
- **The arrow on the landing page does not start the run.** It carried my text to the home page and put it into the "New project" field there. The helper line changed to "You are signed in. Press the arrow to start." I had to press a second arrow. On the landing page there was no sign that the first arrow only moves me to another page.
- **"Sign in" goes to the same home page** as the arrow. "Sign in" and the arrow have the same result, so the two entry points are not different on screen.
- **"Docs" does nothing.** The URL changed to `#`. The page did not change.
- **Logo:** it underlines on hover and on keyboard focus, and it reloads the landing page. My guess was right.
- **The tabs are tabs.** "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and the helper to "lumen starts from what you give it." My guess was right, but only after a click.
- **Attach** opens a file chooser. It gets a grey background on hover. It does not say which file types it accepts.
- **The sphere reacts to the pointer.** The lit spot moves toward the pointer, and it also drifts on its own over time. Clicking it does nothing. So it is decoration that moves. Movement next to the only input pulls attention away from that input.
- **Scroll does nothing.** The page is one screen. My guess that L10 is a footer was close, but there is nothing else in it.
- **Keyboard focus** on the tab shows a black rectangle around "Free exploration". The focus ring is visible. Good enough, not a strength.

---

## 2. home.html

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| H1 | Top left | Logo "lumen" | Go home | Sure |
| H2 | Top right | "$2.02 of $200 this month" | Spend this month against a monthly limit | Guessing. I do not know if $200 is a hard cap, a budget I set, or a plan limit. |
| H3 | Top right corner | Circle with "LZ" | My account menu | Guessing |
| H4 | Left column, heading | "Projects 7" | List of my research runs, count 7 | Sure |
| H5 | Left column, first sub-column | Status per project: red dot "Waiting on you", spinner "Running", filled dot "Finished", hollow dot "Stopped" | State of each run | Sure for "Waiting on you" and "Running". Guessing for the difference between "Finished" and "Stopped". |
| H6 | Left column, middle | Project title (bold) and one or two lines of summary | Name and last update of each run | Sure |
| H7 | Left column, right edge | Dollar amount and "Updated ..." per row | Cost so far, and time of the last activity | Sure (cost). Guessing (whether "Updated" is the last agent action or the last time I looked). |
| H8 | Right panel, top, grey background | "New project" with the same two tabs, field, Attach, arrow as the landing page | Start a new run | Sure |
| H9 | Right panel, below | "Latest findings": six rows, each with a title, project name and time, and a tag: "Open question", "Confirmed", "Dropped" | Results across all projects, newest first | Guessing on order. Sure on purpose. |
| H10 | Finding tags | Hollow square "Open question", filled square "Confirmed", dash "Dropped" | Status of each finding | Guessing. The marks are small and look like checkboxes. |

### 2.2 What was hard to tell apart, and what had the wrong weight

- **The finding tags (H10) look like checkboxes.** A hollow square next to "Open question" and a filled square next to "Confirmed" read as "unchecked" and "checked". I expected to tick them. They are not controls.
- **The project status marks (H5) and the finding tags (H10) are two different vocabularies with the same visual language.** Both use small dots or squares in grey or black. "Finished" (filled dot) and "Confirmed" (filled square) look nearly the same. "Stopped" (hollow dot) and "Open question" (hollow square) look nearly the same. The meanings are unrelated.
- **"Finished" and "Stopped" are separated only by a filled dot versus a hollow dot, at about 8 px, in the same grey.** In dark mode the difference is smaller still. I had to read the summary line to learn that "Stopped" means I stopped it.
- **Every project row has the same weight, except the first one.** "Waiting on you" is red and is the only colour on the page. That works. But the second row, "Running", has the same weight as the five finished or stopped rows. A live run and a run from two weeks ago look the same apart from a small spinner.
- **The cost column (H7) is as prominent as the title.** "$0.18" is bold black and the same size as the project title. "Updated 2 h ago" is grey under it. The eye reads three bold items per row: status, title, cost. Cost is probably not the most important of the three.
- **"New project" and "Latest findings" share one grey panel.** They are two unrelated jobs: start something, and read results. The panel makes them look like one tool. The heading weight is the same for both.
- **"Latest findings" duplicates the project list.** Each finding row names its project in grey ("Pop-stack fertility, 4 min ago"). It is not clear on screen whether a click goes to the finding or to the project.
- **The header has no navigation.** There is no link to a projects page, settings, or docs. The only objects in the header are the logo, the spend, and "LZ".
- In dark mode the right panel is a dark grey and the left column is black. The split is weaker than in light mode. The two columns read as one surface.

### 2.3 After interaction: which guesses were wrong

- **"LZ" does nothing.** The URL changes to `#`. No menu opens. My guess that it is an account menu is unconfirmed; on screen it is a dead circle.
- **"$2.02 of $200 this month" does nothing** on hover and on click. No tooltip, no breakdown. I still do not know what the $200 is.
- **The finding tags show nothing on hover.** No tooltip explains "Open question" or "Dropped".
- **The project row is a link.** Hovering it underlines the title. Clicking anywhere in the row, the status label included, opens that project's session page. My guess was right.
- **A finding row is a link to the project session, not to the finding.** It opens the session and draws a black box around the matching line in the "Recorded findings" block of the work log. The box is on the left side of the page. The finding also exists in the right rail, and that one is not highlighted. I looked right first and saw nothing change.
- **The empty arrow starts a run immediately.** I pressed it with nothing typed. It opened a new running session called "Free exploration" and the agent started "Thinking". There was no confirmation and no cost estimate. "An area of mathematics, or none" does say that empty is allowed, but nothing on the screen says that the arrow commits money.
- **A cursor-following halftone blob appears on the white background.** When the pointer is over the project list, a grey dot cloud appears above it, offset from the pointer, between "Projects 7" and the first row. It looks like a rendering stain, not like a hover state. It does not mark the hovered row.
- **The list changes after an action in a session.** After "Approve" or "Not now" in the waiting project, that row moved to "Running" with "Updated just now" and a new summary. After "Stop" in the running project, its row moved to "Stopped" with "You stopped it." My guess that H5 is live state was right.

---

## 3. session.html

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| S1 | Top left | Logo, then breadcrumb "Projects / Pop-stack fertility" | Where I am. "Projects" goes back to home. | Sure |
| S2 | Top right | Spinner "Running", "$0.94 spent", "2 h 14 min elapsed", a black square and "Stop", then "LZ" | Run state, cost, duration, a control to stop the run, account | Sure (state, cost, time, Stop). Guessing (LZ). |
| S3 | Left column, top | "You" label and a grey box: "Push it to n = 11 before you trust the conjecture." | My message to the agent | Sure. I took it as my first message. |
| S4 | Left column | "lumen" label, then an indented block with a thin left rule: "Thinking", "Ran 2 min 41 s" with a monospace output box, "Recorded 2 findings" with two rows and tags | The agent's work steps for this turn | Sure that it is the agent's work. Guessing on whether "Thinking" is a summary or the raw reasoning. |
| S5 | Left column, under S4 | Plain paragraph in larger black text: "It holds at n = 11, two terms past..." | The agent's answer to me | Guessing. It has no label, and it is the same colour as my message. |
| S6 | Left column, bottom | "Reply to lumen" field, Attach, arrow; helper "lumen keeps working while you write. It reads your message at its next step." | Send a message to the running agent | Sure |
| S7 | Right rail, top | "Findings 5", subtitle "What lumen has found, newest first.", three findings with title, tag and one-line evidence, "Show all 5" | Results of this project | Sure |
| S8 | Right rail, middle | "Call tree", subtitle "lumen and the agents it started.", "lumen, the lead" with "Running", then three indented rows "reader", "compute-perm", "compute-dyck", each "Finished" | Which sub-agents ran, and their state | Guessing. "Call tree" is a developer term. I understood it only from the subtitle. |
| S9 | Right rail, bottom | "Files 7", seven monospace paths | Files the agent produced | Sure that they are files. Guessing that I can open them. |

### 3.2 What was hard to tell apart, and what had the wrong weight

- **The agent's answer (S5) looks like my message (S3) more than like the agent's work (S4).** S3 and S5 are both larger black body text. S4 is small, grey and indented. The "lumen" label sits above S4, not above S5. So S5 floats with no speaker. I had to infer that S5 is lumen's reply.
- **"Recorded 2 findings" in the log (S4) and "Findings 5" in the rail (S7) show the same objects twice,** in different layouts, with the same tags. The screen does not say that these are the same records.
- **Every heading in the rail has the same weight.** "Findings", "Call tree" and "Files" are the same size and boldness, stacked in one grey column. Findings are the product's output. Call tree is diagnostic. Files are raw material. They look equally important.
- **The finding tags again look like checkboxes,** as on home. On this page they sit next to rows that also have a left rule and indentation, which makes them look even more like a task list.
- **"Stop" has the same weight as the status text next to it.** It is plain black text with a small black square. The square reads as the stop glyph of a media player, so I guessed right, but it does not look like a button. It sits in a row of read-only facts.
- **Status vocabulary drifts between regions.** S2 says "Running". S8 says "Running" for the lead and "Finished" for the sub-agents. S7 tags say "Open question", "Confirmed". The rail has two status systems in one column, with nearly identical dot and square marks.
- **The log has no visible start.** The top of the left column shows a "You" message, so I assumed the conversation starts there. Nothing on screen shows that older content exists above it: no scroll bar, no fade, no "earlier steps" marker.
- **The helper under the reply field is the same small grey as other secondary text.** "It reads your message at its next step" is the one sentence that tells me my message will not interrupt the agent. It is easy to miss.
- In dark mode the output box in "Ran" is a black box with a grey border on a black page. It is barely separated from the surrounding text.

### 3.3 After interaction: which guesses were wrong

- **The conversation does not start at the top of the screen.** Scrolling up in the left column shows an earlier "You" message ("Act as an independent researcher..."), several "Thinking" steps, a "Searched" table with arXiv and OEIS rows, and "Started 3 agents in parallel". The first screen showed only the last turn. My guess about S3 was wrong.
- **Files do not open.** Clicking a file path does nothing. There is no hover state. "Files 7" is a list of names only.
- **Call tree rows do not open.** Clicking "reader" or "lumen, the lead" does nothing. No hover state.
- **A finding in the rail is a link to the log.** Clicking "Induction on descents" in the rail underlines it and draws a black box around the same finding in the log on the left. That is the only place the screen connects S4 and S7.
- **"Show all 5" expands the rail in place** and changes to "Show fewer". The two extra findings include one "Dropped" finding with a strikethrough title. On home the "Dropped" finding has no strikethrough. Same status, two looks.
- **When expanded, "Files" moves below the fold** and the rail scrolls on its own. Nothing shows that the rail scrolls.
- **"Stop" is a two-step control, and the second step never goes away.** The first click turns it into a black button "Stop now?". The header shifts left to make room. Escape does not cancel it. A click elsewhere does not cancel it. There is no "Cancel". It stays armed until I press it.
- **"Stop now?" stops at once.** The status changes to "Stopped", the time changes to "stopped just now", and "Stop" disappears. The log gets a "You: Stop." message that I did not type, and a lumen "Stopped" step: "Everything recorded so far is kept."
- **After a stop, the rail still says work is in progress.** "Induction on descents" still reads "The general case is being written up in research/proof-sketch.md." The run is stopped. The text is stale.
- **After a stop, the reply field stays the same.** Only the helper changes to "This project has ended. A message starts it again from where it stopped." The field and the arrow look exactly the same as in a running project. A message here restarts a paid run, and nothing in the control says so.
- **Sending a reply works as the helper says.** My message appeared as a "You" box with "Queued. lumen reads it at its next step." The agent status did not change. My guess was right.
- **The waiting project (opened from the red row on home) has an approval card in the log:** "Spend about $2.40 more to extend the count to n = 14?" with "Approve $2.40" and "Not now". This card has a red left rule and is the clearest control on any of the three pages. But the header still shows "Stop" while the run is "Waiting on you", and the reply helper still says "lumen keeps working while you write". Both contradict "Waiting on you".
- **"Approve" and "Not now" become my messages.** "Approve" inserts "You: Approved: spend about $2.40 on n = 13 and 14." "Not now" inserts "You: Not now." In both cases the card disappears and the status goes to "Running".
- **The decision persists across reloads.** After I approved once, reopening the same project showed the approved state and no card. I could not see the card again without a fresh browser profile.
- **The log can open part-way down, with clipped content under the header.** In the stopped project "Parking functions by lucky cars", the log opened scrolled to the bottom. The top line was cut by the header, half a finding row was visible, and the "lumen" label had no content under it. After "Not now", the top of the log showed a "You" label with an empty space under it. Both look like broken layout.
- **The cursor-following halftone blob also appears here.** It shows as a grey (light mode) or white (dark mode) dot cloud near the pointer, behind the log and next to the column edge. On a work screen full of text it reads as a smudge or a loading artifact. It also appears as dotted bands between log blocks while the pointer is over them, which look like dotted dividers that are not there.

---

## 4. Problems that cross all three pages

- **The same composer (field, Attach, arrow) does four different things** on screen with no visible difference: on landing it moves text to home; on home it starts a paid run at once; in a running session it queues a message; in an ended session it restarts a paid run.
- **Small square and dot marks carry five different status vocabularies:** project state, finding state, sub-agent state, run state in the header, and "Dropped" with or without strikethrough. They use the same size, the same greys, and nearly the same shapes.
- **Dead controls look live.** "Docs", "LZ", the spend line, file paths, and call-tree rows all look like links or are styled like the links next to them. None of them responds.
- **Written promises that the screen does not keep:** "You sign in first" (no sign-in); "lumen keeps working while you write" on a run that waits on me; "being written up" on a stopped run.
