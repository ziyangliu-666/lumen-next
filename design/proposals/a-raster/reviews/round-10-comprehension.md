# First-time comprehension review: landing, home, session

Method: Playwright headless shell, 1440x900, light and dark color scheme. I judged only the pixels, the cursor shape, and the URL after a click. I did not read the source. Light and dark show the same layout; I report a difference only where one exists.

---

## 1. Landing (`landing.html`)

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| L1 | Top left, dot-grid icon plus "lumen" | Logo and product name | Go to the start of the site | Sure |
| L2 | Top right, "Docs" and "Sign in" | Text links | Read documentation; log in | Sure |
| L3 | Left, large three-line headline, third line grey | Slogan | Tell me the product is for "frontier work" | Sure that it is a slogan. No idea what "frontier work" means until I read L4 |
| L4 | Under the headline, two grey lines | Product description | Tells me: a research agent for mathematics | Sure |
| L5 | Under L4, "Free exploration" (underlined) and "From a starting point" | Two tabs | Choose how the agent starts | Guessing. They look like plain text with one underline. They could also be two headings |
| L6 | Under L5, bordered input with "An area of mathematics, or none", "Attach", black arrow square | Prompt field with a file button and a submit button | Start a project | Sure for the field and the arrow. Guessing that "Attach" is a button, because it has no border and looks like part of the placeholder |
| L7 | Under L6, small grey line "lumen picks its own question and reports back. You sign in first." | Help text for the field | Says what happens on submit | Sure |
| L8 | Right half, a large dot-halftone sphere | Decoration or brand illustration | No idea. It takes half the screen and carries no label | Guessing that it is decoration |
| L9 | Bottom left, tiny "lumen (lm), the SI unit of luminous flux." | Footnote on the name | A joke about the name | Sure |
| L10 | Whole background, a faint dot grid | Texture | Nothing | Guessing; in light mode it is almost invisible |

### 1.2 What I could not tell apart, and false equal weight

- **L8 against L3 to L7.** The sphere is the largest object on the page and has the highest contrast. The input L6, which is the only thing I must use, has less visual weight than the sphere. The screen tells me to look at the sphere, and the sphere does nothing I can name.
- **In light mode the sphere reads as a dark ball with a pale patch.** The pale patch looks like a hole or a print fault, not like a light. In dark mode the same patch reads as a highlight. The two schemes give the same graphic two different meanings.
- **L5: tabs or headings.** The unselected tab has the same grey as the help text in L7. Nothing frames the two items as one control.
- **L6: "Attach" against the placeholder.** "Attach" sits inside the field, in the same grey as the placeholder text. It reads as a continuation of "An area of mathematics, or none".
- **"or none" in the placeholder.** It tells me that an empty field is valid. The arrow does not show this. I had to infer that an empty submit is allowed.
- **L2 and L6 look equally important for the first step.** L7 says "You sign in first", so I expect that I must use "Sign in" before L6. The screen does not show which of the two is the entry point.
- **L9 and L4 have the same grey.** The joke footnote has the same visual rank as the product description.

### 1.3 After interaction: which guesses were wrong

- **L8 is not static.** The bright spot on the sphere follows the mouse pointer, and it moves when I change the tab. The cursor stays an arrow over it, and a click does nothing. So it is decoration that reacts. Nothing tells me that, and nothing tells me why the tab change moves it.
- **"You sign in first" is false.** An empty submit, a submit with text, the Enter key, and "Sign in" all go straight to the home page with no sign-in step. The help text describes a step that does not exist.
- **The landing submit does not start a project.** It goes to home, puts my text into the home "New project" field, and changes the help text to "You are signed in. Press the arrow to start." So I must press a second arrow. The first arrow looked final and was not. An empty submit goes to home with nothing filled in, and no message says what happened.
- **L5 tabs: my guess was right.** "From a starting point" changes the placeholder to "Paste a paper, a repo or a question" and the help text. The keyboard focus ring is visible and clear.
- **"Attach" is a button.** It gets a grey hover background and opens a file picker. My guess was right, but only the hover state confirms it.
- **"Docs" goes nowhere.** The URL changes to `#` and the page stays the same. A first-time user sees a dead link.
- **The logo goes to the same page.** That is expected, but on this page it gives no feedback.

---

## 2. Home (`home.html`)

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| H1 | Top bar, left, logo | Logo | Go home | Sure |
| H2 | Top bar, right, "$2.02 of $200 this month" | Spend against a monthly budget | Show how much money I used | Sure what it says. Guessing whether $200 is a cap that stops work or only a reference number |
| H3 | Top bar, far right, circle "LZ" | My account | Account menu | Sure |
| H4 | Left column, heading "Projects 7" | Section title with count | List of my projects | Sure |
| H5 | Left column, seven rows: status at left, title and summary in the middle, cost and "Updated ..." at right | Project list | Open a project; see its state | Sure about the purpose. Guessing about the columns, because they have no headers |
| H5a | Status column: red "Waiting on you", spinner "Running", filled dot "Finished", hollow dot "Stopped" | Project state | Show which project needs me | Sure for red and spinner. Guessing for the filled dot against the hollow dot |
| H5b | Cost column: "$0.18" etc. | Cost per project | Show spend | Guessing: total so far or last run? |
| H6 | Right column on a grey panel, "New project", tabs, input, arrow | Same start control as the landing page | Start a new project | Sure |
| H7 | Right column, "Latest findings", six rows with a title, project name and time, and a badge at right | Results across all projects | Read what the agent found | Sure about the purpose |
| H7a | Badges: hollow square "Open question", filled square "Confirmed", dash "Dropped" | Finding state | Show how sure a result is | Sure that they are states. Guessing what "Open question" means for a finding |

### 2.2 What I could not tell apart, and false equal weight

- **"Finished" against "Stopped" (H5a).** A filled grey dot and a hollow grey dot at 8 px, both in grey text. At normal viewing distance they are the same mark. The summaries make it worse: "Motzkin paths" is "Finished" but its text says "it stopped and said so"; "Restricted growth functions" is "Stopped" and says "You stopped it". The difference is who stopped it. The screen does not say that.
- **"Open question" against "Confirmed" (H7a).** The only difference is a hollow or a filled 8 px square. The words carry the meaning; the icons add nothing and look alike.
- **"Open question" is a finding state and also looks like a project state.** "Pinnacle sets" is "Finished" but its summary says "One question ... is still open". A user cannot tell if this is the same "open question" as the badge.
- **All seven project rows have the same weight.** The red row needs action; the other six do not. Only the 8 px dot and the red word mark it. The row title, size and spacing are the same as the rest. The row is first in the list, which helps, but the list sort order has no label, so I cannot tell if it is first because it is urgent or because it is newest.
- **H6 and H7 share one grey panel.** "New project" (an action) and "Latest findings" (a feed to read) look like one region. The panel colour groups them, but they have nothing in common.
- **H6 has the same visual weight as H5.** The input and the black arrow are the strongest objects on the page. On a page where one project waits for me, the strongest call to action is "start another project".
- **H5b and H2: cost numbers have no unit context.** Bold "$0.94" in each row has more weight than the row's state. Cost is not the most important thing on a row, but it is the boldest.
- **The project summary is the only explanation of "Waiting on you".** "Open it to approve or decline" is grey body text. The required action is in the lowest-contrast text on the row.

### 2.3 After interaction: which guesses were wrong

- **The whole row is a link, not only the title.** A click on the status, the summary or the cost opens the project. Hover underlines only the title, so the screen suggests that only the title is a link.
- **A finding opens its project and highlights the finding in the transcript, not in the Findings list.** I expected a finding detail view. There is no finding detail anywhere. The click lands on a one-line row in the log with a black outline.
- **"Dropped" looks different on the session page.** On home, "The peak-height distribution is already known" is plain text. On the session page the same finding is struck through. The same state has two looks.
- **"LZ" goes nowhere.** The cursor becomes a hand, the URL becomes `#`, and nothing opens.
- **H2 is not interactive.** No hover, no tooltip. My question "is $200 a hard cap?" has no answer on screen.
- **The submit on home starts a project at once.** It does not ask for anything else. An empty submit starts "Free exploration" with no confirmation. This differs from the landing page, where the same control only moves me to home.
- **A pointer-following dot pattern appears in the background** near the cursor. It is faint. It has no meaning and it looks like a rendering fault over the list.

---

## 3. Session (`session.html`, "Pop-stack fertility")

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| S1 | Top bar, left, logo, "Projects / Pop-stack fertility" | Breadcrumb | Go back to the project list | Sure |
| S2 | Top bar, middle right, spinner "Running", "$0.94 spent", "2 h 14 min elapsed" | Project state, cost and run time | Show what the agent does now | Sure |
| S3 | Top bar, "Stop" with a black square | Stop button | Stop the agent | Sure |
| S4 | Top bar, "LZ" | Account | Account menu | Sure |
| S5 | Left column top, label "You", grey box "Push it to n = 11 before you trust the conjecture." | My first message | The task I gave | Guessing. It reads as the first message of the conversation |
| S6 | Left column, label "lumen", an indented block with a thin left line: "Thinking", "Ran 2 min 41 s" with a code box, "Recorded 2 findings" with two rows and badges | The agent's work steps | Show what the agent did | Sure about the purpose. Guessing about the indented block: is it one step or a group of steps? |
| S7 | Left column, a plain paragraph "It holds at n = 11 ..." | The agent's reply to me | The answer in plain words | Sure |
| S8 | Left column bottom, input "Reply to lumen", "Attach", arrow, help text | Message box | Send a message to the agent | Sure |
| S9 | Right panel, "Findings 5", three findings with a body line and a badge, "Show all 5" | Result list for this project | Read results | Sure |
| S10 | Right panel, "Call tree", "lumen, the lead" Running, three indented rows "reader", "compute-perm", "compute-dyck" Finished | The agent and its sub-agents | Show who works on what | Sure what it shows. No idea if I can open a sub-agent |
| S11 | Right panel, "Files 7", seven monospace paths | Files the agent wrote | Open or download a file | Guessing that they open |

### 3.2 What I could not tell apart, and false equal weight

- **The transcript start against a scrolled transcript.** The first screen shows "You" at the top with the same spacing as a conversation start. Nothing shows that 2 h of earlier work sits above it. There is no visible scrollbar, no fade, no "earlier" marker.
- **"Recorded 2 findings" (in the log) against "Findings" (in the panel).** The same findings appear twice with the same badges. The screen does not say that one is the event and the other is the current list.
- **"Confirmed" (square) and "Open question" (hollow square) in the log at 8 px.** The same problem as on home.
- **"Thinking" text against tool output against the reply.** "Thinking" is grey body text; the reply S7 is black and larger. That rank is correct. But "Thinking", "Ran" and "Recorded" labels are all 11 px bold and look like one kind of heading. A step that cost money ("Ran") looks the same as a step that did not ("Thinking").
- **"Stop" has the same weight as "$0.94 spent".** It is plain text with a small square, not a button shape. It sits in a row of read-only facts. I can tell it is a control only from the icon.
- **"Running" appears twice with the same look**: in S2 (the project) and in S10 ("lumen, the lead"). The screen does not say if these are one state or two.
- **Call-tree rows and file rows look clickable but are not (see 3.3).** Files look like links because of their monospace and row rules. The finding titles look exactly like the file rows in weight, and they are clickable.
- **The right panel has three sections of equal weight.** Findings, Call tree and Files all use the same heading size and rules. For a reader who asks "what did it find?", Findings is the answer, and the other two are support. The screen does not rank them.

### 3.3 After interaction: which guesses were wrong

- **S5 is not my first message. Wrong guess.** Scrolling up shows a long log: a first "You" message ("Act as an independent researcher ..."), searches of arXiv and OEIS, three sub-agents, a saved file, another run, three more findings and a long reply. The first screen gives no sign of this.
- **The speaker label sticks to the top while I scroll, and text shows through behind it.** Lines of the log are cut in half under the sticky "lumen" label. On the waiting project, after I approved, the sticky label says "You" over an empty area, because the "You" block above it has scrolled away.
- **Faint rows of dots appear across the log while the pointer moves.** They sit over messages and code boxes. They look like a rendering fault.
- **Files do not open.** The cursor stays an arrow and a click does nothing. A user who wants `research/proof-sketch.md` has no way to see it.
- **Call-tree rows do not open.** I cannot see what "reader" did from the panel. The only record is the "Started 3 agents" table far up in the log.
- **Findings in the panel do not open a detail.** A click scrolls the log to the "Recorded" row and outlines it. A click on a "Recorded" row in the log outlines the same finding in the panel. The link exists in both directions, but nothing tells me that a click will move the other column.
- **"Show all 5" expands the panel and pushes Files below the fold.** The panel then scrolls on its own, and its top item is cut off at the top edge with no header to anchor it.
- **"Stop" asks once.** The button turns black with "Stop now?". If I do nothing, after a few seconds it returns, now with a border it did not have before. That is a third look for the same control. If I confirm, the log adds a "You: Stop." message that I did not type, and lumen answers "I stopped at your request". The project state becomes "Stopped" with a hollow dot.
- **A reply shows "Queued. lumen reads it at its next step."** inside my message box. That is clear. A large empty gap appears above my message.
- **On the waiting project ("Inversion sequences"), Approve and Not now insert a "You" message that I did not type** ("Approved: spend about $2.40 on n = 13 and 14." or "Not now."). After either one, the help text under the message box still says "lumen is waiting for your answer above." That text is stale: lumen is running again.
- **The approval prompt asks about "n = 14", and the message it writes for me says "n = 13 and 14".** The two do not match.
- **The stopped project ("Parking functions") opens scrolled to the bottom, with a cut-off finding row under the sticky label at the top.** The first thing I see on that page is half a line of text.
- **Free exploration's empty state shows "No files yet." in monospace**, in the same face as a file path, so it reads like a file called "No files yet.".

---

## 4. Problems that repeat on all three pages

1. **State marks are too small and too alike.** Filled dot, hollow dot, filled square, hollow square, dash, all near 8 px in grey. The words carry all the meaning. Users who scan by shape will misread.
2. **Clickable and not clickable look the same.** Project rows, findings and "Attach" are clickable. Files, call-tree rows, the budget and the avatar look the same or more clickable, and do nothing (or go to `#`).
3. **The text says one thing and the screen does another.** "You sign in first" (no sign-in), "waiting for your answer" (after the answer), "Docs" (dead link).
4. **Visual weight does not follow importance.** The landing sphere outweighs the input. On home, the new-project arrow outweighs the project that waits for me. In the session top bar, "Stop" weighs the same as the cost.
5. **Hidden structure.** The session log hides its history above the fold with no cue, and two of the four session columns (call tree, files) suggest detail that does not exist.
6. **Decorative dot effects follow the pointer on every page** and leave faint dot rows over content. On the landing page they are the hero. On home and session they look like faults.
