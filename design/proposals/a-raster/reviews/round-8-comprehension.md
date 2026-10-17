# First-time comprehension review: landing, home, session

Method: Playwright, headless Chromium, 1440x900, light and dark color scheme. I judged only what was on screen. I did not read the source. All three pages fit in one viewport at 1440x900. Only the session log and the session right column scroll. Light and dark have the same layout. Dark mode changed no comprehension result, so I note dark mode only where it differs.

Screenshots are in /tmp/lumen-shots/out/ (landing-*, home-*, session-*, L-*, H-*, S-*, D-*).

---

## 1. Landing (landing.html)

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| L1 | Top left | Logo: a small shaded ball and the word "lumen" | Brand. Probably a link to this page | sure (brand), guessing (link) |
| L2 | Top right | Two text links, "Docs" and "Sign in" | Documentation and account entry | sure |
| L3 | Left, upper half | Headline "Now you can do any frontier work. Just start." The last line is grey | Marketing claim | sure |
| L4 | Left, under the headline | Two-line description: "a research agent for mathematics..." | The only sentence that says what the product does | sure |
| L5 | Left, above the input | Two words, "Free exploration" and "From a starting point". The first word has an underline | Probably tabs that select a mode. They could also be links | guessing |
| L6 | Left, middle | Text field with the placeholder "Name an area of mathematics, or leave it open", an "Attach" control inside the field, and a black square button with an arrow | Starts a research run from this page | guessing |
| L7 | Under the input | Small grey text "lumen picks its own question and reports back. You sign in first." | Explains the mode. Warns that sign-in comes next | guessing |
| L8 | Right half | Large halftone sphere made of dots. The bright spot moves slowly | Decoration. Maybe a visual of "lumen" as light | guessing |
| L9 | Bottom left | Very small text "lumen (lm), the SI unit of luminous flux." | Looks like a legal or copyright footer. It is trivia | guessing |
| L10 | Whole background | Faint dot grid | Texture | sure (decoration) |

### 1.2 What was hard to tell apart, and what had the wrong weight

- L5 and L2 look the same. Both are small plain text with no box. The selected tab has only a thin underline. Nothing shows that L5 is a control that changes L6, and not two more nav links.
- "Attach" (inside L6) and the arrow button (L6) are two buttons in one box. Attach has no border of its own, so it reads as part of the placeholder until hover.
- L8, the sphere, takes half the screen. It has more visual mass than L3 and L6 together. It carries no information. The eye goes to it first and finds nothing.
- L9 has the same type style as L7. A reader cannot tell legal text from product text by looks.
- L3 says "any frontier work". L4 says "mathematics". The large text and the small text disagree about scope. The screen gives the claim to the large text.
- Cause: the page uses one weight of small grey text for tabs, helper text, nav and footer. Hierarchy comes only from the headline size. Everything under the headline has the same weight.

### 1.3 Interaction, and which guesses were wrong

- L1 logo: reloads the landing page. Guess correct.
- L2 "Docs": goes to "#". Nothing opens. The link is dead.
- L2 "Sign in": goes straight to the home page. No sign-in form appears. My guess (an account entry) was wrong: there is no account step on screen.
- L5: these are tabs. "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and changes L7 to "lumen starts from what you give it. You sign in first." Guess correct, but only after I clicked.
- L6 Attach: opens a file chooser. Guess correct.
- L6 arrow with text "knot invariants": goes to the home page. The text is in the home composer, with the note "You are signed in. Press the arrow to start." Nothing started. My guess was wrong. The arrow does not start a run. The user must press a second arrow on a second page.
- L6 arrow with an empty field ("leave it open"): goes to the home page with an empty composer and no note. Nothing started, and nothing on screen says why. The placeholder invites an empty submit, and an empty submit does nothing visible.
- L7 "You sign in first": wrong. No sign-in happened in either path.
- L8 sphere: the bright spot drifts on a timer. It does not follow the cursor. Click does nothing. Guess (decoration) correct.

---

## 2. Home (home.html)

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| H1 | Top left | Logo "lumen" | Brand, link home | sure |
| H2 | Top right | "$2.02 of $200 this month" | Spend against a monthly budget. Whose budget (mine, the team's) is not said | sure (spend), guessing (owner) |
| H3 | Top right corner | Circle with "LZ" | Account menu | guessing |
| H4 | Left, about 57% of width | "Projects 7" and seven rows | List of my research runs | sure |
| H4a | Left column of each row | Status: red dot "Waiting on you", spinner "Running", filled dot "Finished", hollow circle "Stopped" | State of each project | sure for words, guessing for glyphs |
| H4b | Middle of each row | Bold title and a two-line grey summary | Project name and its latest result | sure |
| H4c | Right of each row | Dollar amount and "Updated ..." | Cost of that project, and last activity time | guessing (the column has no label; "$0.18" could be a price or a budget) |
| H5 | Right panel, grey background, top | "New project", two tabs, the same composer as the landing page | Start a new run | sure |
| H6 | Right panel, below H5 | "Latest findings": six rows with a title, a grey subline, and a tag on the right ("Open question", "Confirmed", "Dropped") | Results across all projects | guessing |
| H6a | Subline of each finding | "Pop-stack fertility, 4 min ago" | The project the finding belongs to, and when | guessing (it has no label; it reads like a description at first) |
| H7 | Background | Faint dot grid | Texture | sure |

### 2.2 What was hard to tell apart, and what had the wrong weight

- H4 and H6 have the same row shape: bold title, grey subline, a small mark at the edge. A first-time user sees two lists and has to read the words to learn that one is projects and one is findings.
- The project summaries in H4 already state the findings ("The identity maximises preimages up to n = 11"). H6 repeats them as separate rows. Without a label, the same sentence in two places reads as two different things.
- Status marks: projects use circles (filled, hollow, red, spinner). Findings use squares (hollow, filled) and a dash. At about 8 px the shapes are hard to tell apart. Both sets use "hollow" for two different meanings: hollow circle is "Stopped", hollow square is "Open question".
- "Open question" is black and bold. "Confirmed" is grey and lighter. The unresolved state looks more important than the confirmed state. That may be deliberate, but the screen does not explain it.
- The spinner for "Running" is a partial ring. In a still frame it reads as a letter ("u" or "c") in front of "Running".
- H5 is the heaviest region on the page. It has a grey panel, a black arrow button and a heading. The one item that needs the user ("Waiting on you", red, top row) has only a red word. The page asks "start something new" louder than "answer the one that is blocked".
- H5 (create) and H6 (read results) share one grey panel. The grey implies they are one group. They are not related.
- H4c: the cost column has no header. "$0.94" with "Updated 4 min ago" under it could be cost so far, a budget, or a quote.
- Cause: one row template for two kinds of object, no column headers, and status carried by glyph shape at a size where shape is weak.

### 2.3 Interaction, and which guesses were wrong

- Hover on a project row: the title underlines. The whole row opens the project. Status word, summary and cost all open the same session page. Guess (row is a link) correct; nothing showed this before hover.
- Click "Inversion sequences..." (Waiting on you): opens a session with an approval box. Guess correct.
- Click a finding in H6: opens the project's session page and outlines the matching finding row in the log. My guess was partly wrong. I expected a finding page. The finding has no page of its own, and the outline in the session is thin and easy to miss.
- H2 budget: no hover text, no click action. It cannot be explained or changed from here.
- H3 "LZ": goes to "#". No menu. Dead.
- H5 tabs and composer: same as the landing page. A typed area plus Enter opens a new session page with status "Running". Guess correct.
- Hover on finding tags and status words: no tooltip. The glyph meanings stay unexplained.
- H7: a cloud of darker dots sometimes appears near the cursor or near a hover target. It carries no meaning. In one frame it sat on top of the "Projects" heading and looked like a loading indicator.

---

## 3. Session (session.html, the "Pop-stack fertility" project)

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| S1 | Top left | Logo, then breadcrumb "Projects / Pop-stack fertility" | Navigation back to the list; current project name | sure |
| S2 | Top right | Spinner "Running", "$0.94 spent", "2 h 14 min elapsed" | Run state, cost, duration | sure |
| S3 | Top right | Bordered "Stop" button | Stops the run | sure |
| S4 | Top right corner | "LZ" circle | Account | guessing |
| S5 | Left, about 57% of width, scrolls | A conversation log. Blocks are labelled "You" (grey box) and "lumen" (label, then an indented column of steps, then a plain paragraph) | The record of what lumen did and said | sure |
| S5a | Inside a lumen block | Small bold labels "Thinking", "Ran 2 min 41 s", "Recorded 2 findings" | Step types | sure for "Ran" (code box), guessing for "Thinking" (maybe it expands) |
| S5b | Inside "Ran" | Monospace box with a command and output | Terminal output of a computation | sure |
| S5c | Inside "Recorded 2 findings" | Two rows with "Confirmed" and "Open question" tags | Findings created at that step. Probably links | guessing |
| S5d | After the indented column | Plain black paragraph "It holds at n = 11..." | lumen's message to me, the summary of that turn | guessing (it has no label of its own; it looks detached from the "lumen" label above) |
| S5e | Top of the log | "lumen" label, then the fragment "checked to n = 8. I have it to n = 10." | The end of an earlier message | no idea at first; it looked like a whole message that starts mid-sentence |
| S6 | Bottom left | "Reply to lumen" field, Attach, arrow, and "lumen keeps working while you write. It reads your message at its next step." | Send a message into a running job | sure |
| S7 | Right column, grey, scrolls | "Findings 5, What lumen has checked, newest first." Three findings with tags and text, "Show all 5" | Results of this project | sure |
| S8 | Right column | "Call tree, lumen and the agents it started." Lead plus "reader", "compute-perm", "compute-dyck", each "Finished" | Sub-agents and their state | guessing (the term "call tree" needs the subtitle) |
| S9 | Right column | "Files 7, What lumen has written, newest first." Monospace paths. The last path is cut by the window edge | Files produced. Probably openable | guessing |

### 3.2 What was hard to tell apart, and what had the wrong weight

- S5c and S7 show the same findings with the same row style and the same tags. S5 "Started 3 agents" rows and S8 show the same agents. S5 "Saved a file" rows and S9 show the same files. Each object is drawn twice in the same style, so a user cannot tell which copy is the real one and which one is a reference.
- S7 subtitle says "What lumen has checked". The list holds "Open question" and, after "Show all", "Dropped" items. Those are not checked. The label and the content disagree.
- S5d, lumen's actual answer, is the largest black text in the log. It has no label. The "lumen" label sits above the grey indented steps, so the label seems to belong to the steps, and the answer seems to float.
- The "You" box has a grey fill. It is visually heavier than lumen's answer. The user's own short message ("Push it to n = 11...") is the strongest block on screen.
- The page opens scrolled to the end. The sticky "lumen" label at the top sits over the tail of a scrolled-away message (S5e). The first thing a new user reads is a sentence fragment. After more scrolling, a sticky "You" label sat over an empty strip and looked like an empty message.
- S2 is one run of small text: "Running $0.94 spent 2 h 14 min elapsed". Three facts have no separators. "$0.94 spent" has no budget context here, unlike home.
- S3 "Stop" has a border and is the heaviest control in the header. The same button stays when the project is stopped (see 3.3). Its weight does not change with the state.
- S7, S8 and S9 have identical heading size. Findings are the product's output. Call tree and Files are supporting detail. The screen gives them equal rank.
- S9 is cut at the bottom edge with no scroll cue. A user does not learn that the right column scrolls apart from the log.
- Cause: duplicated objects in one visual style, no label on the answer paragraph, sticky labels that detach from their content, and one heading level for all right-column sections.

### 3.3 Interaction, and which guesses were wrong

- Scroll the log up: the log holds the first prompt, searches, three agents, saved files, and more runs. The structure is consistent. S5e was a sticky label over the end of a long earlier message. My first reading (a whole message) was wrong.
- S5a "Thinking": click does nothing. It does not expand or collapse. Thinking is always shown in full.
- S5c recorded finding rows in the log: click does nothing. My guess (links) was wrong.
- S7 finding title: click outlines the matching row in the log and scrolls the log to it. This is the only link between the two copies. It works in one direction only. The outline is a thin 1 px box.
- S7 "Show all 5": expands to five findings, including a struck-through "Dropped" one. Label becomes "Show fewer". Guess correct.
- S8 call tree rows: click does nothing. There is no way to see what an agent did, apart from scrolling the log.
- S9 file paths: no hover state, click does nothing. My guess (openable) was wrong. "What lumen has written" is a list of names that cannot be read.
- S3 "Stop", first click: the button fills black and reads "Stop now?". Second click: status becomes "Stopped", the log gets a "You: Stop." block and a lumen "Stopped" step. The button then still says "Stop", now filled black, heavier than before. It looks more urgent after the run has ended.
- Stopped project ("Parking functions..."): the header shows "Stopped" and a "Stop" button. Clicking it twice stops the stopped project again. It adds another "Stop." message and "I stopped at your request." This is wrong behaviour, and the screen invites it.
- S6 on a stopped project: the hint says "A message starts it again from where it stopped." I sent a message. It shows "Queued. lumen reads it at its next step." Status stays "Stopped". The screen promises a restart and then shows none.
- S6 on a running project: the message appears as a "You" block with "Queued. lumen reads it at its next step." Guess correct.
- Waiting project ("Inversion sequences..."): the approval box sits in the log with a red left edge, "Approve $2.40" and "Not now". Approve adds "Approved: spend about $2.40 on n = 13 and 14." and status becomes "Running". "Not now" adds "Not now." and status also becomes "Running". Both behave as I guessed. Two faults: the header text "waiting 2 h" reads as "wait 2 hours" before the user learns it means "has waited 2 hours"; and the approval box can scroll out of view in a longer log, with only the red header word left to show that an answer is needed.
- S1 "Projects": returns to home. Guess correct. The word is grey and small, and it is the only way back besides the logo.
- S4 "LZ": goes to "#". Dead.
- The cursor dot cloud also appears on this page, along the boundary between log and right column. It is noise.

---

## 4. Faults that repeat across pages

1. Dead controls: "Docs", "LZ" on both signed-in pages, file paths, call tree rows, log finding rows, "Thinking". Each looks like it does something.
2. The landing promise "You sign in first" is false on screen. "Sign in" and the arrow both skip to the signed-in home.
3. The landing arrow does not start a run. A second press on a second page is necessary. An empty submit does nothing and says nothing.
4. "Stop" is present, active and visually strong on projects that are already stopped.
5. "A message starts it again" is not followed by any restart on screen.
6. Status glyphs (circles for projects, squares for findings, hollow for two different states) have no legend and no tooltip, and are too small for shape to carry meaning.
7. Each object appears twice in one style: findings (home summary and home list; session log and session column), agents (log and call tree), files (log and file list). Only one of the six pairs is linked, and only in one direction.
8. Decoration competes with content: the sphere on the landing page, and the cursor dot cloud on home and session.
