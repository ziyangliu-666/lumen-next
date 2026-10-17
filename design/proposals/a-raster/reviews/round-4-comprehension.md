# First-time comprehension review: landing, home, session

Method: Playwright, headless Chromium, 1440x900, light and dark color scheme.
I judged only the rendered screen. I did not read the source. To check if a
region accepts a click, I clicked it or read the pointer style under the mouse
(the pointer is the cursor feedback a real user would see).

Screenshots are in `/tmp/lumen-review/shots/`. The base views are
`<page>-light.png` and `<page>-dark.png`. Interaction views start with `i-`.

---

## 1. landing.html

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| L1 | Top left, "lumen" | Wordmark | Brand; probably a link to this page | sure |
| L2 | Top right, "Docs", "Sign in" | Header links | Documentation; account sign-in | sure |
| L3 | Left, large three-line headline, third line grey | Hero headline | Sales message | sure |
| L4 | Left, two-line grey paragraph | Product description | Says what lumen is: a research agent for mathematics | sure |
| L5 | Left, "Free exploration" / "From a starting point" | Two tabs | Choose how a project starts | guessing (they could also be two links, or a filter) |
| L6 | Left, input with "Attach" and a black arrow block | Start box | Type a field, attach a file, start a project | sure for the input; guessing for what "Attach" accepts |
| L7 | Under the input, small grey line | Help text | Explains the selected tab and says sign-in comes first | sure |
| L8 | Right half, large halftone dot sphere, plus a flat dot ellipse under it (light mode only) | Decorative illustration | Brand image. I cannot tell if it is a data plot, a loading state, or decoration | guessing |
| L9 | Bottom left, "lumen (lm), the SI unit of luminous flux." | Footnote | Explains the name | sure |
| L10 | Whole background, very faint dot grid | Texture | Decoration | guessing (visible only when you look closely) |

### 1.2 What I could not tell apart, wrong weight, and why

- **The sphere (L8) has the largest visual weight on the page, and it carries no information.** It occupies the whole right half. The start box (L6), the only action, is a 550 px strip at the lower left. The eye goes to the sphere first.
- **The ellipse under the sphere in light mode reads as a second object.** It is a separate dot field with a gap above it. It can be a shadow, a reflection, a disc, or a table. In dark mode the ellipse is absent, so the two schemes show two different illustrations.
- **The tabs (L5) look like plain text links.** The only tab signal is a 2 px underline under the selected label. Nothing shows that the two labels change the input below. The tab labels also do not say what is different. "Free exploration" and "From a starting point" only become clear when you read the help line (L7) and it changes.
- **"Attach" and the arrow look equally important inside one box.** Both are inside the same border. The arrow block has no label. A first-time user can read the arrow as "next step" or "sign in" and not as "start the project".
- **The help line (L7) is the only place that says "You sign in first".** It is the smallest text on the page, in grey, directly under the input.
- **The footnote (L9) has the same grey and size as the help line (L7).** Both lines look like the same kind of text, but one is an instruction and one is trivia.
- **The headline third line, "Just start.", is grey.** Grey on this page means "secondary" everywhere else (L4, L7, L9). Here it is the call to action. The colour says the opposite of the words.

### 1.3 After interaction: which guesses were wrong

- **L8 was wrong. The sphere is a light model that follows the mouse.** The lit side moves toward the cursor and the ellipse under it shifts to the opposite side. Nothing on screen tells you this. The pointer stays the default arrow, so it does not look interactive. With the pointer on the left, the sphere shows a hard vertical terminator near x = 1030. At normal size it reads as a half moon or a rendering seam. In a zoomed crop (`z-seam.png`) it is a sharp jump in dot size, not a gradient.
- **L5 was right, with one surprise.** The tabs change the placeholder ("Paste a paper, a repo or a question") and the help line ("lumen starts from what you give it."). They do not change anything else. The selected state is only the underline and a darker text colour.
- **L6 was partly wrong.** "Attach" opens a native file chooser. Nothing says which file types it accepts. Pressing Enter or the arrow does not show a sign-in step. It goes straight to the home page with the text prefilled and the message "You are signed in. Press the arrow to start." The help line promised "You sign in first", and no sign-in screen appeared. A first-time user does not know if they now have an account, or whose account it is.
- **The arrow with an empty input also skips sign-in** and opens the home page.
- **L2 "Sign in" goes straight to the home page** with no form. "Docs" goes to `#` and does nothing.
- **L1 is a link** (pointer cursor). I guessed this correctly.

---

## 2. home.html

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| H1 | Top left, "lumen" | Wordmark | Link to home | sure |
| H2 | Top right, "$1.55 of $200 this month" | Spend against a monthly budget | Shows cost so far | sure for the meaning; guessing if it is a cap or a forecast |
| H3 | Top right, "LZ" in a square | Account avatar | Account menu | guessing |
| H4 | Left column, "Projects 4" and four rows | Project list | Open a project | sure |
| H5 | In each row: title, status dot and word, one or two lines of summary | Project row | Status and last activity | sure |
| H6 | Right side of each row: price and "Updated ..." | Cost of the project and last update | Cost and freshness | sure |
| H7 | Row 1 status "Waiting on you" in red, summary first sentence in black | Alert | Tells me this project needs my decision | sure |
| H8 | Right panel, grey background, "New project" with the same tabs and input as the landing page | Start box | Start a new project | sure |
| H9 | Right panel, "Latest findings", four rows with a title, project name and time, and a badge | Findings feed across projects | Show results | guessing (could be the newest finding per project, or the four newest overall) |
| H10 | Badges: "Open question" with a dashed border, "Confirmed" with a grey fill | Finding status | Status of each finding | guessing (I read dashed as "not settled", but nothing says so) |

### 2.2 What I could not tell apart, wrong weight, and why

- **"Finished" and "Stopped" look the same.** Both use the same grey filled dot and the same grey text. The only difference is the word. On the session page, "Stopped" uses a hollow circle, so the two pages disagree.
- **"Running" and "Waiting on you" use the same dot shape.** Only colour separates them. In dark mode the red is the single coloured element on the page, so it works there. A user with red-green or low colour vision only has the word.
- **The new-project box (H8) has the same weight as the project list (H4).** It sits at the top of the right panel with a black arrow block, the strongest mark on the page. A returning user with a project "Waiting on you" is pulled toward "start another one" instead of "answer the one that waits".
- **The findings feed (H9) and the project summaries (H5) repeat the same facts.** "Counts to n = 12 match no OEIS sequence" appears in row 1 summary and in the feed. "The closed form holds to n = 12" appears in row 3 and in the feed. I could not tell what the feed adds.
- **Row 1 has a black summary sentence, the other rows have grey summaries.** The black sentence is the request. This difference is small and is the only signal that the row text is a question to me and not a report.
- **The price on each row (H6) and the monthly total (H2) use the same bold style.** I could not tell if row prices are spend so far or the cost of the next step, until I read "Asks to spend about $2.40 more", which is a third cost on the same screen.
- **The panel split is a grey background only.** The left list and the right panel have no headings with weight. "Projects 4" and "New project" are small grey labels, the same as the row metadata.
- **The badges (H10) have no legend.** "Dashed = open, filled = confirmed" is a guess.

### 2.3 After interaction: which guesses were wrong

- **H4/H5 were right.** A row click opens the project's session page. The pointer is a hand over the whole row. On hover the row gets a grey background and the title is underlined.
- **The row hover background is misaligned.** It extends about 15 px past the right edge of the row divider, into the gutter in front of the grey panel.
- **The hover also draws a halftone dot cloud around the pointer.** It is not attached to the row. It spills into the row above and the row below, and it draws dots over the summary text of the next row ("n = 11"). In dark mode it shows as light dots over white text. It reads as a rendering glitch, not as hover feedback.
- **H9 was wrong. Findings are not clickable.** The pointer stays an arrow and a click does nothing. Each finding names a project, but you cannot go from the finding to the project or to its evidence. A first-time user expects that link.
- **H10 badges are not interactive** and show no tooltip. Their meaning stays a guess.
- **H3 "LZ" is a link to `#`.** The pointer is a hand, but a click opens no menu. There is no visible way to sign out, see the account, or see the budget settings.
- **H2 is not interactive.** It is not possible to see or change the budget from here.
- **H8 behaves as I guessed.** Enter or the arrow opens a new session page. The breadcrumb shows the typed text as the project title ("graph colouring"). With an empty input the title is "Free exploration". Cost is "$0.00 just started". No confirmation, no cost estimate, and no budget warning appear before the project starts.

---

## 3. session.html (Pop-stack fertility, also opened for the other three projects)

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| S1 | Top left, "lumen  Projects / Pop-stack fertility" | Wordmark and breadcrumb | Go back to the project list | sure |
| S2 | Top centre-right, "Running  $0.94  for 2 h 14 min" | Project status, cost and run time | Live state | sure |
| S3 | Top right, "LZ" | Account avatar | Account menu | guessing |
| S4 | Left column, top: a large paragraph with no speaker label | Agent message | lumen's report | guessing (no label, so I could not tell who wrote it or if it is the start of the page) |
| S5 | Left column: "You" and a one-line message | My earlier instruction | Conversation history | sure |
| S6 | Left column: "lumen" and an indented block with a left rule: "Thinking", "Ran" with a code block, "Recorded 2 findings" with badges | Agent work log for one turn | Show reasoning, commands and results | sure for the parts; guessing where the block ends |
| S7 | Left column: a large paragraph after the indented block | Agent reply at the end of the turn | Summary for me | guessing (same style as S4, and also no label) |
| S8 | Left column, bottom: "Reply to lumen" input, "Attach", arrow, help line | Reply box | Send a message to the running agent | sure |
| S9 | Right panel, "Findings 5", "What lumen has checked, newest first.", three findings with title, badge and one-line body, "Show all 5" | Findings list for this project | Results and their state | sure |
| S10 | Right panel, "Call tree", "lead" and three indented names with status | Agent list | Shows the main agent and its sub-agents | guessing (I read indentation as "started by lead") |
| S11 | Right panel, "Files 7", seven paths in monospace grey | Output files | Open or download the files lumen wrote | guessing |

### 3.2 What I could not tell apart, wrong weight, and why

- **S4 and S7 have the same style, and neither has a speaker label.** The "lumen" label belongs only to the indented work block S6. The two large paragraphs look like a third voice, or like page text. I could not tell that S4 is the end of an earlier lumen turn.
- **The page opens scrolled to the bottom with no sign that there is more above.** The first visible line is mid-conversation. No scrollbar, no fade, and no "earlier messages" marker appear in the screenshot.
- **Agent text in S6 is grey; agent text in S4 and S7 is black and larger.** Grey "Thinking" text has the same colour as metadata ("2 min 41 s", help lines). It reads as secondary, but it holds the reason for the cost decision ("n = 12 ... would need your approval").
- **The findings appear twice with the same badges:** in the transcript ("Recorded 2 findings") and in the right panel (S9). I could not tell if they are the same objects or two copies that can disagree.
- **The badges have three states and only two have a box.** "Confirmed" has a filled box, "Open question" has a dashed box, and "Dropped" (seen in the Parking functions project and under "Show all") is plain grey text with a strikethrough title in the panel but no strikethrough in the transcript. Three treatments for one field.
- **"Finished" sub-agents and the "Running" lead use the same dot shape.** Only fill colour separates them. "Stopped" is a hollow circle. Hollow vs grey vs black is a three-step code with no legend.
- **The Call tree (S10) and Files (S11) look as important as Findings (S9).** All three have the same heading style and spacing. For a first-time user, Findings matters and the other two are diagnostics.
- **The status line in the header (S2) uses the same style for three different things.** "$0.94" is bold. "for 2 h 14 min" is grey. On other projects the same slot says "waiting for 2 h", "yesterday, after 1 h 05 min" and "3 days ago, after 40 min". The slot changes meaning per state: duration, wait time, or end time.
- **The reply box (S8) has the same black arrow block as the start box on the landing and home pages.** It looks like "start a new project", not "send a message".

### 3.3 After interaction: which guesses were wrong

- **S4 was wrong as a "start".** Scrolling up shows a long history: my first instruction, several "Thinking" blocks, a "Searched" table, a "Started 3 agents" table and "Saved a file". The page hid all of this below the fold, above the visible start.
- **The same halftone hover cloud from the home page follows the pointer over the transcript.** It draws dots across the "Searched" table text and the "Thinking" text. In dark mode it is light dots on black over white text. It has no function that I could find and it reduces legibility where the pointer is, which is where the user reads.
- **S10 was right about the structure, and wrong that it is interactive.** "lead", "reader", "compute-perm" and "compute-dyck" have no pointer and do nothing on click. The transcript has a separate "Started 3 agents" table that shows each agent's task. The panel does not show the task, so the panel is the weaker copy.
- **S11 was wrong. Files are not clickable.** The pointer stays an arrow and a click does nothing. There is no way to open `research/proof-sketch.md`, which the first finding names as the place where the proof is written.
- **S9 findings and badges are not clickable.** A finding does not jump to the transcript turn that recorded it.
- **"Show all 5" works.** It expands to five findings and changes to "Show the newest 3". The label under "Findings" says "newest first", but there are no times on the findings, so the order cannot be checked.
- **S6 "Thinking" is not collapsible.** I expected the work log to fold. It does not react to clicks.
- **S8 works as I guessed.** A message appears at the end as "You" with "Queued. lumen reads it at its next step." The page then scrolls so the old content moves up. No lumen reply came after 5 seconds, and nothing showed that one is due.
- **S2 is not interactive.** There is no stop or pause control anywhere on the page. A first-time user who sees "Running" and a growing cost cannot find a way to stop it. The Parking functions project shows that a stop is possible ("You stopped it after 40 minutes", "Stop here. It is known."), but the only way is to type it.
- **The approval card (Inversion sequences) works.** The card has a red left rule, a bold question and two buttons, "Approve $2.40" and "Not now". After a click, the card is replaced by a "You" message ("Approved: ..." or "Not now.") and a lumen "Thinking" line. The header changes from "Waiting on you" to "Running". After "Not now", the header also says "Running", so "Running" covers both "computing" and "writing up".
- **Ended projects keep the same reply box.** The help line changes to "This project has ended. A message starts it again from where it stopped." The box looks the same as for a running project. A user can restart a paid run without a cost prompt.

---

## 4. Problems on all three pages

- **No region on any page explains the status vocabulary.** Running, Waiting on you, Finished, Stopped, Confirmed, Open question, Dropped: seven states, five visual codes (dot, hollow dot, filled badge, dashed badge, strikethrough), no legend and no tooltip.
- **Light and dark differ in content, not only in colour.** The landing sphere loses its ground ellipse in dark mode. In dark mode the "Confirmed" badge box is dark grey on near-black. The text is readable, but the box edge is hard to see, so "Confirmed" and "Open question" look more alike than in light mode.
- **The black arrow block means three different actions:** start a project from the landing page, start a project from home, and send a reply in a session. They look identical.
- **Pointer feedback is inconsistent.** Rows and links show a hand. Findings, files, call tree entries, badges and the sphere show the default arrow, but some of them look like list items that should open.
- **The halftone dot cloud follows the pointer on the home and session pages** and draws over the text the user reads. On the landing page the same pointer moves the light on the sphere.
