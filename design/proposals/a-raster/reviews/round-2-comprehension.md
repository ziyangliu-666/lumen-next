# First-use comprehension review: landing, home, session

Method: Playwright, headless Chromium, 1440x900, light and dark colour scheme. I judged only the rendered screen. I did not read the source. Screenshots are in `/tmp/lumen-review/` (first view) and `/tmp/lumen-review/i/` (after interaction).

Confidence key: **sure**, **guessing**, **no idea**.

---

## 1. landing.html

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Confidence |
|---|---|---|---|---|
| L1 | Top left, "lumen" | Product wordmark | Brand; maybe a link to this page | sure (wordmark), guessing (link) |
| L2 | Top right, "Docs" and "Sign in" | Navigation links | Docs: read documentation. Sign in: open a login form | sure |
| L3 | Left, large headline "Now you can do any frontier work. Just start." | Marketing headline | Sell the idea | sure |
| L4 | Left, grey paragraph under the headline | Product description | Says lumen is a research agent for mathematics | sure |
| L5 | Left, "Free exploration" and "From a starting point" | Two tabs | Choose the mode of a new research job | guessing. They look like tabs because of the underline, but they could also be section headings or filter links |
| L6 | Left, bordered field with "Attach" and a black arrow button | Prompt input | Type a field of mathematics, attach a file, start | sure (input), guessing (that it starts real work without sign-in) |
| L7 | Left, small grey text under the field | Helper text for the active tab | Explains what the mode does | sure |
| L8 | Right half, halftone dot sphere | Decorative illustration | Mood. Maybe a "light" metaphor for the name | guessing |
| L9 | Under the sphere, flat dot ellipse (light mode only) | Shadow or floor of the sphere | Decoration | guessing |
| L10 | Bottom left, "lumen (lm), the SI unit of luminous flux." | Footnote about the name | Explain the name | sure |
| L11 | Whole background, faint dot grid | Texture | Decoration | guessing. At first I took it for screen noise |

### 1.2 What was hard to tell apart, and why

- **L5 tabs against L3/L4 text.** The tabs use the same typeface and size as body text. The only signal is a thin underline under one label. The inactive tab looks like ordinary grey copy, not like a control.
- **L6 "Attach" against the placeholder.** "Attach" is plain grey text inside the field, at the same size and weight as the placeholder. It reads as part of the placeholder sentence, not as a button. It has no icon and no border.
- **L7 helper text against L10 footnote.** Both are the smallest grey text on the page. One explains the control, the other is trivia about the name. The screen gives them equal weight.
- **L8 sphere against everything.** The sphere takes half the screen. It carries no information, but it is the heaviest object on the page. The input (L6), which is the only action, is smaller than the headline and sits at the bottom of the left column.
- **Light and dark are two different pictures.** In light mode the sphere reads as a dark ball with a pale patch, plus a floor ellipse. In dark mode it reads as a glowing ball, with no floor. In light mode the pale patch reads as a hole or a crater, not as the lit side. The same object changes meaning between schemes.
- **Who can use the input is unclear.** "Sign in" is in the top right, but the input is live on a page for signed-out users. The screen does not say whether I must sign in, whether it costs money, or whether submitting starts a paid job.

### 1.3 After interaction: which guesses were wrong

- **L2 "Docs":** wrong guess. It goes to `#`. Nothing opens. It is a dead link.
- **L2 "Sign in":** wrong guess. There is no login form. It goes directly to the signed-in home page.
- **L5 tabs:** correct, they are tabs. Clicking "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and the helper text to "lumen starts from what you give it." The input itself does not change, so the two modes look identical except for grey text.
- **L6 input:** my guess that a sign-in comes first was wrong. Enter or the arrow goes directly into a running session. No sign-in, no confirmation, no cost warning.
- **L6 empty submit, Free exploration:** this starts a project with an invented prompt, "Find something new, wherever you think it is." The user did not write that sentence, but the session shows it under "You".
- **L6 empty submit, From a starting point:** nothing happens. The field gets a focus ring. No message says that input is required.
- **L6 "Attach":** it opens a file chooser. It is a button. Its only visible hover state is a faint grey fill.
- **L8 sphere:** it reacts to time and to the pointer in light mode. The pale patch moves. In dark mode I saw no change. The movement does not tell me anything about the product.
- **L10 footnote:** not a link. Correct guess.

---

## 2. home.html

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Confidence |
|---|---|---|---|---|
| H1 | Top left, "lumen" | Wordmark | Go home | sure |
| H2 | Top right, "$1.55 of $200 this month" | Spend meter | Shows spend against a monthly limit | guessing. "of $200" could be a budget I set, a plan limit, or a credit balance |
| H3 | Top right, "LZ" in a square | Account button (initials) | Open account menu | guessing. The square border makes it look like a button or a key cap |
| H4 | Thin rule under the header | Divider | Separates header | sure |
| H5 | Left label "New project" | Section label | Labels the input row | sure |
| H6 | Tabs + input + Attach + arrow + helper text | Same composer as the landing page | Start a new project | sure |
| H7 | Grey rule across the full width | Section divider | Separates "new" from "list" | sure |
| H8 | Left label "Projects 4" | Section label with count | Labels the list | sure |
| H9 | Row 1, "Inversion sequences avoiding 021", red dot, "Waiting on you" | A project that needs my decision | Click to approve or reject the n = 14 extension | sure (status), guessing (where to act) |
| H10 | Row 1, second line, bold "Asks to extend the count to n = 14, about $2.40." then grey text | The pending request and its cost | Tell me what I must decide | sure |
| H11 | Row 2, "Pop-stack fertility", grey dot, "Running" | A project in progress | Click to watch it | guessing. The dot is grey, the same grey as a disabled item |
| H12 | Row 3, "Finished"; Row 4, "Stopped" | Done projects | Click to read results | sure (status) |
| H13 | Right column per row, "$0.18" over "2 h ago" | Cost of the project and a time | Spend per project; time of... start? last activity? | sure (cost), no idea (which time) |
| H14 | Empty lower half | Nothing | Nothing | sure |

### 2.2 What was hard to tell apart, and why

- **"Finished" against "Stopped".** Both are plain grey words with no dot. They look identical. Only the word differs. A user scanning the list cannot see which ones failed or were cancelled.
- **"Running" against inactive.** The Running dot is grey and it pulses between grey and black. In a single frame it looks like an "off" indicator. In dark mode the grey dot is close to the background.
- **H13 time column.** "2 h ago", "4 min ago", "Yesterday", "3 days ago". The screen does not say what event the time belongs to. The session page for row 2 says "2 h 14 min" in its header, but the home row says "4 min ago". A user cannot connect the two numbers.
- **H2 against H13.** The header money and the row money use the same style. The header is a monthly total, the rows are per project. No label separates "this month" from "lifetime of this project".
- **H10 cost against H13 cost.** Row 1 shows "$0.18" on the right and "about $2.40" in the text. A first-time reader cannot tell at a glance which number is spent and which is a quote.
- **H5 and H8 labels against content.** "New project" and "Projects" sit in a far-left column, in the same weight as row titles. They read as two more items, not as section headings.
- **Rows look equally clickable.** All four rows have the same layout, the same title weight and no chevron or hover state. The screen promises that each row opens.
- **"Waiting on you" is the only urgent thing, but the action is not on screen.** There is no "Approve" or "Review" button in the row. The user must guess that the row opens.

### 2.3 After interaction: which guesses were wrong

- **H9 "Waiting on you" row:** wrong guess. Clicking the title, the status or the row does nothing. The one project that needs the user cannot be opened. There is no way on this screen to answer it.
- **H11 "Running" row:** correct. It opens the session page. It is the only row that is a link. Keyboard Tab confirms this: only this row gets a focus ring.
- **H12 "Finished" and "Stopped" rows:** wrong guess. They do not open. The screen gives no sign that they are different from row 2.
- **H3 "LZ":** wrong guess. It goes to `#`. No menu opens. There is no way to sign out or reach settings.
- **H2 spend meter:** no hover text, no link. Its meaning stays a guess.
- **Rows, hover:** no hover state on any row, including the one that works. The pointer gives no help.
- **H6 composer:** same as landing. A typed value starts a session at once. The session title becomes the raw text I typed ("x" or "enumerative combinatorics").

---

## 3. session.html

The page opens scrolled to the bottom of the conversation. The first thing visible is a paragraph with no speaker label.

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Confidence |
|---|---|---|---|---|
| S1 | Header left, "Projects / Pop-stack fertility" | Breadcrumb | Back to the list; current project name | sure |
| S2 | Header right, dot "Running", "$0.94", "2 h 14 min" | Project status, cost, elapsed time | Live state of the job | sure (status, cost), guessing (time: elapsed, or remaining?) |
| S3 | Header far right, "LZ" | Account button | Account menu | guessing |
| S4 | Main column top, paragraph with no label | A lumen message, continued from above | Earlier conclusion | guessing. No speaker label, so it could be a quote, a summary or a system note |
| S5 | "You", large text "Push it to n = 11 before you trust the conjecture." | My earlier message | History | sure |
| S6 | "lumen", block with "Thinking" label and grey text | The agent's reasoning | Show why it acts | sure |
| S7 | "Ran 2 min 41 s" and a grey monospace block | A command and its output | Evidence | sure |
| S8 | "Recorded 2 findings" with "Confirmed" and "Open" badges | Findings created at this step | Link the step to the findings list | sure |
| S9 | Black paragraph after the findings | lumen's conclusion for this step | The main answer | sure |
| S10 | Bottom, "Reply to lumen" field + Attach + arrow, and grey helper text | Reply composer | Send a message to the running agent | sure |
| S11 | Right panel, "Findings 5", "What lumen has checked, newest first." | Results list | Main output of the project | sure |
| S12 | Badges "Open", "Confirmed", "Dropped" (struck through) | Finding state | Show proof state | guessing. "Open" could mean "unsolved", "click to open", or "open question" |
| S13 | Finding cards: bold title, grey body, file path in monospace | One finding each | Read result; maybe click for detail | guessing (clickable) |
| S14 | Bottom of the right panel, "Call tree" cut off, with a fade | Agent hierarchy | Show sub-agents | sure (meaning from its subtitle), but only half visible |

### 3.2 What was hard to tell apart, and why

- **S4 speaker.** The top paragraph has no "lumen" label. The speaker label exists only for the next block. On first load the user does not know who wrote the first text on screen.
- **"You" against headings.** My own messages are set larger than anything lumen writes. "Push it to n = 11 before you trust the conjecture." looks like a section title. The user's words outrank the agent's results.
- **Thinking text against helper text.** The "Thinking" body is small grey text. The composer helper text and the "What lumen has checked" subtitle are the same small grey text. Reasoning, captions and instructions look alike.
- **S8 inline findings against S11 findings.** The same finding appears twice, in two styles: a table row in the conversation and a card in the panel. Nothing on screen links them. A user can think they are two separate findings.
- **"Open" badge against "Confirmed" badge.** One is outlined, one is filled. That is the only difference. "Open" with an outline looks like a button labelled "Open".
- **"Dropped" badge.** Struck-through grey text in a grey box is the least readable element on the page. In dark mode it is almost invisible.
- **Status words in two cases.** The conversation says "finished" (lower case, for agents). The call tree says "Finished" (capitalised). The home page says "Finished" for a project. Three meanings, one word.
- **S2 "Running" against the conversation.** The header says Running. The conversation ends with "I am writing that up now." and then nothing: no spinner, no "working" line, no timestamp. The only live signal is a small dot that pulses grey to black.
- **S2 time.** "2 h 14 min" does not say "elapsed". On home the same project says "4 min ago".
- **S10 composer width.** The reply field starts at the far-left page edge. The messages start in a second column. The field spans the speaker-label column, so it does not look attached to the conversation.
- **S14 cut off.** The right panel hides "Call tree" and all of "Files" below the fold, behind a fade. On first view the user does not know that a Files list exists. The empty-session page shows Files at once, so the panel order changes meaning with data.

### 3.3 After interaction: which guesses were wrong

- **S4:** scrolling up shows it is the end of a long lumen turn that starts under a "lumen" label far above. Guess was right, but the screen opened at a point that hides the label.
- **Scroll up, more structure appears:** "Searched" tables (arXiv, OEIS rows), "Started 3 agents in parallel", "Saved a file". These step types use the same tiny grey label as "Thinking". All step types look alike.
- **S13 finding cards:** wrong guess that they are clickable. Clicking a card does nothing. Clicking the inline finding in the conversation does nothing. There is no detail view and no link between the two copies.
- **File paths** (`research/proof-sketch.md`, `code/popstack.py`, and the Files list): wrong guess. They look like links (monospace, distinct) but do nothing when clicked. The user cannot open the files that the findings cite as evidence.
- **Call tree rows** (reader, compute-perm, compute-dyck): not clickable. They only repeat the "Started 3 agents" table.
- **S2 "Running":** not clickable. "2 h 14 min" does not change after 12 seconds of waiting, so it is not a live clock.
- **S3 "LZ":** goes to `#`. Dead, as on home.
- **S1 "Projects":** correct, it goes back to home.
- **S10 reply:** sending works. My message appears under "You" in the large style. lumen answers under a "Thinking" label: "Your message is queued. I will read it when the current step ends." That is a status message, not reasoning, but it wears the reasoning label. My own message has no "queued" mark, so it looks already read.
- **S10 empty send:** nothing happens and no message appears. Only a focus ring.
- **Live updates:** after waiting, no new step appeared and no number changed. The page says "Running" but the screen is static apart from the pulsing dot.
- **New session from the landing or home composer:** the page shows my text under "You", one lumen "Thinking" line, then nothing. Findings 0, Call tree "lead Running", Files 0. There is no progress indicator in the conversation, so the user cannot tell if lumen is working or stuck.

---

## Cross-page problems

- **The composer is identical on three pages** (landing, home, session reply), but it does three different things: start without sign-in, start a new project, reply to a running job. Same look, different consequences.
- **Dead controls that look live:** Docs, LZ (twice), three of four project rows, every finding, every file path, every call tree row. A first-time user who clicks will conclude the product is broken.
- **Status has no consistent visual code.** Red dot = waiting; grey pulsing dot = running; no dot = finished or stopped. Finished and Stopped look the same. Running looks like off.
- **Money appears in four forms** (monthly total, per-project total, quoted cost in text, per-step cost such as "6 s, $0.01") with one visual style. The screen does not separate spent from quoted.
- **Light and dark are not the same design.** The landing sphere changes shape and meaning between schemes. The "Dropped" badge and the grey Running dot lose most of their contrast in dark mode.
