# First-time comprehension review: landing, home, session

Method: Playwright, headless Chromium, 1440x900, light and dark color scheme. I judged only what was on screen. I did not read the source. All screenshots are in `/tmp/lumen-shots/cr/`.

Both color schemes have the same layout. Notes that apply to only one scheme are marked.

---

## 1. Landing (`landing.html`)

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| L1 | Top left, "lumen" | Wordmark | Brand, maybe a home link | Sure |
| L2 | Top right, "Docs", "Sign in" | Site navigation | Docs and account entry | Sure |
| L3 | Left, large three-line headline, last line grey | Slogan | Says the product does "frontier work" | Sure that it is a slogan. No idea what "frontier work" means in practice |
| L4 | Under the headline, two grey lines | Product description | Says lumen is a research agent for mathematics | Sure |
| L5 | "Free exploration" / "From a starting point" | Tabs | Switch between two ways to start | Guessing. The labels do not say what changes |
| L6 | Input box, "Name a field, or leave it open", "Attach", black arrow | Prompt box | Start a research run | Sure that it is the entry point. Guessing whether the arrow starts a run or only signs me in |
| L7 | Tiny grey line under the input | Hint | Says lumen picks its own question and that I sign in first | Sure about the text. It is very hard to read |
| L8 | Right half, large halftone dot sphere | Illustration | Decoration, or a visual for "lumen" (light) | Guessing. It could be a product visual, but nothing on screen says so |
| L9 | Bottom left, "lumen (lm), the SI unit of luminous flux." | Footnote | Explains the name | Sure |
| L10 | Whole background, very faint dot grid | Texture | Decoration | Guessing. Barely visible |

### 1.2 What I could not tell apart, and what looked equally important

- **"Name a field" reads as a form instruction.** On a form, "field" means an input field. Only the description above tells me it means a field of mathematics. The placeholder is the first instruction a new user reads, so the ambiguity sits on the most important line.
- **The tabs look like the hint text.** The inactive tab "From a starting point" has the same grey and nearly the same size as the hint line under the input. The tabs do not look like a control that changes the input. They could also be page navigation.
- **The sphere has the same weight as the headline and the input together.** It fills half the screen. In light mode it is the darkest, heaviest mass on the page. In dark mode it is the brightest. It carries no information, but the eye goes to it first.
- **"Sign in" looks like "Docs".** The hint says "You sign in first", so sign-in is a required step. The link has the same plain style as "Docs". The only statement of the requirement is in the smallest, lowest-contrast text on the page.
- **"Attach" in "Free exploration" mode has no clear purpose.** If lumen picks its own question, I do not know what I would attach.
- **The hint line is too small.** It holds the two facts that change behaviour: who picks the question, and that sign-in comes first. It is about 11 px, grey, in both schemes.

### 1.3 After interaction: which guesses were wrong

- **The sphere is interactive (wrong guess: static).** Its highlight follows the cursor. Nothing tells me this, and the movement has no meaning that I can find.
- **The tabs change only words.** "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and changes the hint. The input itself stays the same. My guess "mode switch" was correct, but the two modes look identical apart from the grey text.
- **Sign-in does not happen (guess contradicted).** The hint says "You sign in first". The arrow takes me straight to the home page, which says "You are signed in. Press the arrow to start." The "Sign in" link also goes straight to home. The screen promises a step that never appears.
- **The arrow does not start a run (wrong guess).** It moves the text to the home page input. I must press a second arrow. The first arrow looks like "go" and is only "carry over".
- **An empty input is accepted.** The arrow with an empty box also goes to home, with no message.
- **"Docs" is a dead link.** It goes to `#`.
- **"Attach" opens a file chooser.** This guess was correct.
- **The page does not scroll.** There is nothing below the fold. The footnote at the bottom suggests more content that does not exist.

---

## 2. Home (`home.html`)

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| H1 | Top left, "lumen" | Wordmark | Home link | Sure |
| H2 | Top right, "$1.55 of $200 this month" | Spend against a monthly limit | Shows how much budget is used | Guessing whether $200 is a hard cap, a plan, or a prepaid balance |
| H3 | Top right, "LZ" in a circle | Account avatar | Account menu | Guessing |
| H4 | Left, "Projects 4" and four rows | Project list | Each row is one research run: status, title, summary, cost, last update | Sure |
| H5 | Left column of each row: "Waiting on you" (red), "Running", "Finished", "Stopped" | Status | State of each project | Sure for red. Guessing for the other three, see 2.2 |
| H6 | Right column of each row: "$0.18", "Updated 2 h ago" | Cost and recency | Money spent and last activity | Guessing. See 2.2 |
| H7 | Right grey panel, "New project", tabs, input | Start form | Start a new run | Sure |
| H8 | Right panel, "Latest findings", four rows with "Open question" / "Confirmed" boxes | Results feed | Recent results across all projects | Sure that it is a feed. Guessing what "Open question" means |
| H9 | Lower half of both columns | Empty space | Nothing | Sure |

### 2.2 What I could not tell apart, and what looked equally important

- **Running, Finished and Stopped look almost the same.** Running is a black dot and black text. Finished is a grey dot and grey text. Stopped is a hollow dot and grey text. At a glance only the red row stands out. A running project, which costs money now, does not look different from one that ended yesterday. In dark mode the white and grey dots are even closer.
- **The cost number is stronger than the status.** "$0.18" is bold, black and right-aligned at the same weight as the title. The status label on the left is lighter. The eye reads title, then price, then status.
- **The cost on the "Waiting on you" row is ambiguous.** The summary asks to spend about $2.40. The right column shows $0.18. I could not tell whether $0.18 is spent so far, or a cost the row asks me to approve.
- **The action that "Waiting on you" needs is not on this screen.** The request is in grey summary text. There is no button. I must guess that the row is a link.
- **"Projects" and "Latest findings" have the same rank.** Both have the same heading size. They show the same projects twice ("Pop-stack fertility" appears in both). I could not tell which one is the main view.
- **The finding badges look like buttons.** "Open question" is a bordered box, "Confirmed" is a filled box. They have the same shape as small buttons. I thought they might be filters.
- **"Open question" has no clear meaning.** It could mean "not yet verified", "unsolved in mathematics", or "lumen has a question for you". The filled-or-outlined style is the only cue that it is lower in rank than "Confirmed".
- **Finding titles and project titles use the same style.** Both are bold black titles with a grey line under them. Only the panel position tells them apart.

### 2.3 After interaction: which guesses were wrong

- **Project rows are links to sessions.** This guess was correct. On hover, the title gets an underline and the row gets a grey background. The grey background starts flush at the status dot with no left padding. It runs about 16 px past the divider line on the right. The row looks misaligned.
- **The background dots react to the cursor.** A band of larger halftone dots appears near the pointer. Above "Projects" it reads as a stray dotted rule. I first took it for a rendering fault.
- **A finding opens its project, not the finding (wrong guess).** "Induction on descents" opens the Pop-stack session and puts a faint grey band on the matching row in the transcript. The right-column card does not change. If the row is already visible, the page does not move, so the click looks like it did nothing.
- **Badges and the budget have no tooltip and do nothing.** "Open question" stays unexplained after interaction.
- **"LZ" is a dead link.** It goes to `#`.
- **The arrow starts a run at once, also with an empty input.** An empty input opens a session titled "Free exploration" that is already "Running". There is no confirmation. The run spends money from one click on an empty form.
- **The new session header has a text error.** It shows "$0.00 spent spent".

---

## 3. Session (`session.html`, default project "Pop-stack fertility")

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| S1 | Header left, "lumen  Projects / Pop-stack fertility" | Breadcrumb | Back to the project list | Sure |
| S2 | Header right, "● Running", "$0.94 spent", "2 h 14 min elapsed" | Run status line | Live state, cost and duration | Sure |
| S3 | Header right, "Stop" box | Button | Stop the run | Sure. It sits far from "LZ" with an empty gap of about 80 px, so I guessed a control is missing there |
| S4 | Top of left column, "lumen" and a paragraph | The end of an earlier lumen message, cut by the header | Conversation history | Guessing |
| S5 | "You", grey box | My message | Conversation history | Sure |
| S6 | "lumen", indented block with a grey rule: "Thinking", "Ran 2 min 41 s" with a code box, "Recorded 2 findings" with badges | Agent work log | Shows what the agent did step by step | Sure about the parts. Guessing about the rank of each part |
| S7 | Black paragraph under the indented block | lumen's answer to me | The conclusion of this turn | Guessing. I told it apart from "Thinking" only by size and colour |
| S8 | Bottom, "Reply to lumen", Attach, arrow, hint | Reply box | Send a message while the run continues | Sure |
| S9 | Right panel, "Findings 5", three cards, "Show all 5" | Findings summary | All results of this project | Sure |
| S10 | Right panel, "Call tree", "lead" and three indented names with status | Agent tree | Shows the agent and the sub-agents it started | Guessing. The subtitle helps, but "lead" is not "lumen" |
| S11 | Right panel, "Files 7", monospace paths | File list | Files the run wrote | Sure what it is. No idea whether the files open. The last row is cut by the bottom of the screen |

### 3.2 What I could not tell apart, and what looked equally important

- **The top "lumen" label looks like part of the header.** It sits about 14 px under the header rule, tight against the text below. It reads as a page title or the end of the header, not as a message author.
- **The same findings appear in two places with the same style.** "Recorded 2 findings" in the transcript and the "Findings" panel use the same titles and the same badges. I could not tell which one is the record and which one is a copy.
- **The step labels are too small to structure the log.** "Thinking", "Ran" and "Recorded 2 findings" are about 12 px bold. That is the same size as the hint text. The log has no visible hierarchy between a step header and its content.
- **One agent has two names.** The transcript author is "lumen". The call tree root is "lead". I had to guess that they are the same thing.
- **"Stop" looks like a badge, and badges look like buttons.** "Stop" is a small box with a 1 px black border. "Open question" is a small box with a 1 px black border. The only action in the header has the same shape as a passive label.
- **Files look like plain text.** No icon, no underline, no hover cue. I could not tell whether they are links.
- **The cut file row hides that the panel scrolls.** The panel shows six and a half of seven files and no scroll cue.
- **Three words describe an ended run.** The status words are "Finished", "Stopped" and, in the reply hint, "ended". A new user cannot tell whether these are three states or one.
- **The time formats in the header are different.** The Inversion session shows "waiting 2 h". The Pop-stack session shows "2 h 14 min elapsed". Both sit in the same place.
- **Inversion session (waiting for approval):** the red header status "Waiting on you" has no link to the approval card. Here the card is visible, but in a longer transcript the header would point to something I cannot see.

### 3.3 After interaction: which guesses were wrong

- **The top "lumen" is a sticky author label (wrong guess: start of a message).** It stays pinned while its message scrolls under it. It collides with the content below it:
  - It overlaps the "Thinking" label when I scroll.
  - After "Approve", a sticky "You" sits over a 14 px sliver of an empty grey box at the top of the transcript.
- **The right panel scrolls on its own, but only by about 13 px.** When it scrolls, the "Findings 5" heading is cut in half under the header by a fade.
- **"Show all 5" shows a fourth state.** It reveals a "Dropped" finding with strike-through text and a grey badge. This state did not appear on the home page. The link then reads "Show the newest 3", a different wording for the same toggle.
- **A finding card selects a transcript row (wrong guess: opens a detail).** The card highlights the matching row in the transcript with a faint grey band. The band runs about 8 px past the column edge. The effect is easy to miss.
- **A call-tree child scrolls the transcript (no idea before).** "reader" scrolls the transcript to where the three agents were started. There is no highlight and no hover cue, so I could not discover this.
- **Files do nothing (guess "maybe opens" was wrong).** A click on a file path has no visible effect.
- **"Stop" asks for confirmation in place.** The first click turns it into a wider, filled "Stop the run?". This pushes the status, cost and time to the left. It reverts after a few seconds with no countdown and no cancel button. The second click stops the run, adds "You: Stop." and "lumen: Stopped" to the transcript, and removes the button.
- **Reply works as the hint says.** The message appears with "Queued. lumen reads it at its next step." This guess was correct.
- **Approval works, but the header changes in an unexpected way.** "Approve $2.40" replaces the card with "You: Approved: spend about $2.40 on n = 13 and 14." The header changes from "waiting 2 h" to "2 h 01 min elapsed" and to "Running". "Not now" leaves the header at "Running".
- **The cursor-reactive dots look like dividers.** In the transcript and in the gutter between the columns, bands of dots appear near the pointer. Between "Recorded 2 findings" and the answer paragraph they look like a dotted section rule that comes and goes.
- **"LZ" is a dead link** (goes to `#`). **"Projects"** in the breadcrumb goes back to home, as I guessed.

---

## 4. Items that apply to all three pages

- **The cursor-reactive halftone dots** appear on every page. On the landing page they are the sphere. On home and session they look like stray dotted rules or rendering faults. Nothing explains them.
- **Badges and buttons have the same shape.** Bordered and filled small boxes are used both for status ("Open question", "Confirmed", "Dropped") and for actions ("Stop", "Not now").
- **Hint lines carry rules but are the smallest text.** Examples:
  - "You sign in first."
  - "lumen keeps working while you write."
  - "This project has ended. A message starts it again from where it stopped."

  All of them are about 11 to 12 px grey text under an input.
- **Dead links:** "Docs" on the landing page and "LZ" on home and session go to `#`.
- **Dark mode:** the filled elements invert to white ("Confirmed", "Approve", the arrow buttons). In dark mode the white arrow box next to the landing input and the bright sphere are the two brightest objects. They pull the eye away from the headline.
