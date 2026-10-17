# First-time comprehension review: landing, home, session

Method: Playwright, headless Chromium, 1440x900, light and dark color scheme. I judged only what the screen shows. I did not read the source. Screenshots are in `/tmp/lumen-review/shots/`.

Light and dark have the same layout and the same problems. Where a problem is worse in one scheme, I say so.

---

## 1. landing.html

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| L1 | Top left, "lumen" | Product name / logo | Brand; maybe a link home | Sure |
| L2 | Top right, "Docs", "Sign in" | Navigation links | Read documentation; log in | Sure |
| L3 | Left, large three-line headline, last line grey | Hero claim | Tell me the product lets me do "frontier work" | Sure it is a headline. No idea what "frontier work" means until I read L4 |
| L4 | Under the headline, two grey lines | Product description | Says lumen is a research agent for mathematics | Sure |
| L5 | Two text items, "Free exploration" (underlined) and "From a starting point" | Tabs or a mode toggle | Choose how the agent starts | Guessing. They look like plain text with one underline. They could also be links |
| L6 | Bordered input with "Attach" and a black arrow button | Prompt field | Type a topic and start | Sure |
| L7 | Small grey line under the input | Helper text | Explains the current mode and says "You sign in first" | Sure |
| L8 | Right half, large halftone dot sphere | Decoration / brand image | None that I can see | Sure it is decoration. No idea what it means |
| L9 | Bottom left, "lumen (lm), the SI unit of luminous flux." | Footnote about the name | Explain the name | Sure |
| L10 | Whole background, faint dot grid | Texture | Decoration | Guessing. At first I took it for a JPEG artefact |

### 1.2 What was hard to tell apart, and why

- **L5 against L2.** "Free exploration" and "From a starting point" use the same weight and size as "Docs" and "Sign in". Nothing marks L5 as a control group (no container, no track, no pill). Only the 2 px underline says "selected". A first-time user can read L5 as two more links.
- **L8 gets the same visual weight as L3 and L6 together.** The sphere is about half the screen. It carries no information. The eye goes to it before it goes to the input, which is the only thing on the page that does something.
- **In light mode, the sphere reads as a hole, not a light.** The "lit" spot is white dots on a field of black dots. That looks like a dent or a hollow, or like a printing defect. In dark mode it reads as a lit sphere. The same image says two different things in the two schemes.
- **L7 is the only place that says what the mode does.** It is 12 px grey text. The difference between the two modes is the most important decision on this page, and it gets the smallest type on the page.
- **"You sign in first" contradicts L6.** The input looks ready to use. L7 says I cannot use it yet. Nothing on screen shows what happens to my text if I press the arrow while signed out.
- **L9 and L4 compete.** Both are small grey text. L9 is trivia, L4 is the product definition. Only size separates them.
- **"Attach" has no visible boundary.** It sits inside the input as grey text plus an icon. It looks like placeholder text until hover.

### 1.3 After interaction: which guesses were wrong

- **L5 (guessing) was right.** Clicking "From a starting point" moves the underline, changes the placeholder to "Paste a paper, a repo or a question", and changes L7 to "lumen starts from what you give it." The control works. It still looks like links before you click.
- **L8 is not static.** The bright spot drifts over time and moves toward the cursor. Nothing on screen says it is interactive, and it does nothing when clicked. It is motion with no meaning.
- **L7 "You sign in first" was wrong.** I typed "Pattern avoidance" in the "From a starting point" tab and pressed the arrow. I went directly to home.html. There was no sign-in step. Home says "You are signed in. Press the arrow to start."
- **The selected mode is lost.** The URL carried `mode=start`. On home, the tab showed "Free exploration" as selected, with my text in the field. A user who chose "From a starting point" now has the wrong mode selected and no warning.
- **The arrow does not start anything.** It only carries the text to home. On home I must press a second arrow. Nothing on the landing page says this.
- **Enter in an empty field also goes to home.** That is consistent with "or leave it open", but the user gets no confirmation that a free exploration was not started.
- **"Docs" goes nowhere.** It opens `#`. There is no page and no message.
- **"Sign in" goes directly to home.** There is no form.
- **"Attach" works.** It opens a file picker. On hover it gets a filled background. I had guessed placeholder text, so I was wrong.
- **There is nothing below the fold.** Scrolling does nothing. That is fine, but L9 at the bottom edge looks like the start of a footer that is not there.

---

## 2. home.html

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| H1 | Top bar left, "lumen" | Logo | Brand / home link | Sure |
| H2 | Top bar right, "$2.02 of $200 this month" | Spend against a monthly budget | Show how much of my money is used | Sure about the numbers. Guessing whether $200 is a cap I set, a plan limit, or a prepaid balance |
| H3 | Top bar right, "LZ" in a circle | Account avatar | Account menu | Guessing |
| H4 | Left column, "Projects 7" and seven rows | List of my research projects | Open a project | Sure |
| H4a | Each row, left: coloured dot + status word | Project status | Show state: Waiting on you / Running / Finished / Stopped | Sure about the words. No idea about the difference between Finished and Stopped |
| H4b | Each row, middle: bold title + two grey lines | Project name + latest summary | Tell me where it stands | Sure |
| H4c | Each row, right: dollar amount + "Updated …" | Cost so far + last activity | Cost and freshness | Sure about cost. Guessing that "Updated" means last agent activity |
| H5 | Right column top, "New project" with tabs, input, helper text | Start a new project | Same as landing L5 to L7 | Sure |
| H6 | Right column bottom, "Latest findings" with four items and badges | Recent results across all projects | Jump to results | Sure about the list. Guessing about the badges |
| H6a | Badges "Open question" (outlined) and "Confirmed" (filled grey) | Finding status | Show if a result is proved/verified or not | Guessing. "Confirmed" by what: computation, proof, a person? |
| H7 | Right column background, light grey (dark grey in dark mode) | Side panel | Separate "new" and "findings" from the list | Sure |

### 2.2 What was hard to tell apart, and why

- **"Finished" and "Stopped" look almost the same.** Finished is a small filled grey dot. Stopped is a small hollow grey ring. At 8 px the difference is a few pixels. The words differ, but the summaries blur them too: "Motzkin paths" is "Finished" and its summary says "so it stopped and said so". "Restricted growth functions" is "Stopped" and its summary says "You stopped it". The rule (Finished = lumen stopped, Stopped = you stopped) is only in the prose.
- **"Running" does not look like a status dot.** In the static screenshot it is a black ring with a black centre. It looks like a selected radio button. That suggests the row is selected, not that the agent is running.
- **"Running" pulses between two shapes.** In some frames it is a ring with a centre, in others a solid black dot. The solid frame looks like the "Finished" dot in a darker grey. A user who glances at the wrong moment sees Running and Finished as the same mark.
- **Every row has the same weight except the red one.** That is correct for "Waiting on you". But "Running" is the second most important state, and it gets no more weight than "Finished" two weeks ago.
- **Cost and time have the same weight in every row.** "$0.94" and "$0.08" use the same bold black. The eye reads the dollar column as the main data column, which it is probably not.
- **H5 and H6 look equally important.** Both are in the same grey panel with the same heading size. H5 is an action. H6 is a feed. Nothing separates them except a gap.
- **H6 duplicates H4.** "Counts to n = 12 match no OEIS sequence" is a finding in H6. The same fact is in the summary of the first row of H4. A new user cannot tell if a finding is a different object from a project summary, or the same text in two places.
- **"Open question" vs "Confirmed" look like buttons.** The outlined "Open question" badge has the same border and radius as a small button. The filled "Confirmed" badge looks like a pressed or disabled button. Neither looks like a passive label.
- **H2 has no visual meter.** "$2.02 of $200" is text only. It does not show urgency, and nothing shows what happens at $200.
- **The grey panel is a different colour from the list, but the top bar line runs across both.** In dark mode the panel is a dark grey next to pure black. The contrast step is small. On a dim screen the two columns look like one surface with a strange seam.

### 2.3 After interaction: which guesses were wrong

- **H4 rows are links to the project page.** Each row opens session.html for that project. Hover gives a grey row background and underlines the title. The hover background extends about 15 px to the right of the row divider, past the column edge. It looks like a layout error.
- **The "Running" row opens a different URL from the other rows.** "Pop-stack fertility" opens `session.html` with no parameter. The others open `session.html?p=…`. The user does not see this, but it is why the running project is the default session page.
- **H6 items are links.** Hover underlines the title. They open the project page and highlight the matching row in the transcript. I had guessed "jump to results", so I was right about the direction. But the result highlight is a faint grey band. It is easy to miss, and the matching item in the session side panel gets no highlight.
- **The badges are not interactive and have no tooltip.** Hovering "Open question" or "Confirmed" shows nothing. The meaning stays unexplained.
- **The status dots have no tooltip.** Hovering "Waiting on you" shows nothing but the row hover.
- **H2 has no tooltip and is not a link.** I still do not know what $200 is.
- **H3 "LZ" goes nowhere.** It opens `#`. There is no menu. I guessed "account menu". It is not one.
- **The H5 tabs work as on the landing page.** The underline moves, the placeholder and helper text change.

---

## 3. session.html (default: "Pop-stack fertility", running)

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | How sure |
|---|---|---|---|---|
| S1 | Top bar left, "lumen  Projects / Pop-stack fertility" | Breadcrumb | Go back to the project list | Sure |
| S2 | Top bar centre-right, "Running", "$0.94 spent", "2 h 14 min elapsed" | Project status line | Live state, cost, duration | Sure |
| S3 | Top bar, outlined "Stop" button | Stop the agent | Halt the run | Sure about the action. No idea what it costs me: does it keep the work? |
| S4 | Top bar far right, "LZ" | Avatar | Account | Guessing |
| S5 | Left column, top: "lumen" label and a paragraph that starts mid-thought | Agent message | Part of a conversation | Guessing. The label is pressed against the top bar. The first message looks cut off |
| S6 | Left column, "You" + grey box "Push it to n = 11 …" | My message | The human side of the chat | Sure |
| S7 | Left column, "lumen" block with left rule: "Thinking", "Ran" + code box, "Recorded 2 findings" + two rows with badges | Agent work log | Show reasoning, the command it ran, and what it recorded | Sure about "Ran". Guessing that "Thinking" is the agent's private reasoning and not a message to me |
| S8 | Left column, plain paragraph "It holds at n = 11 …" | Agent reply to me | The answer | Guessing. It has no label. It could belong to S7 or be a new message |
| S9 | Left column bottom, "Reply to lumen" input + "Attach" + arrow, helper "lumen keeps working while you write …" | Chat input | Send a message to the agent | Sure |
| S10 | Right panel, "Findings 5" with three items, badges, "Show all 5" | Results list for this project | See what has been checked | Sure |
| S11 | Right panel, "Call tree": "lumen, the lead" + three indented agents with status | Sub-agent list | See which agents ran | Sure about the list. Guessing that "call tree" means agents started by agents. The name is jargon |
| S12 | Right panel, "Files 7" + seven paths in monospace | Files the agent wrote | Open or download files | Guessing that they open |

### 3.2 What was hard to tell apart, and why

- **S5, S7 and S8 are all "lumen", but they look like three different things.** S5 is a bold label over body text. S7 is a bold label over an indented block with a left rule. S8 is body text with no label at all. A new user cannot tell where one lumen message ends and the next one starts. S8 looks like it could belong to S7, or to S5.
- **"Thinking" text and reply text differ only in grey.** Thinking is grey 14 px. The reply is black 16 px. In dark mode the grey is close to the reply colour. A user can read a private reasoning note as an answer, or the reverse.
- **The section labels inside S7 ("Thinking", "Ran", "Searched", "Recorded 2 findings", "Started 3 agents", "Saved a file") all have the same small bold style as the speaker labels "lumen" and "You".** The speaker label and the step label look like the same level of heading. The hierarchy is flat.
- **S10 and the "Recorded findings" rows in S7 are the same objects in two places, with two styles.** In S7 they are one-line rows. In S10 they have a title, a body and the same badge. Nothing on screen links the two. I had to guess that they are the same.
- **S2 "Running" and S11 "lumen, the lead — Running" duplicate each other.** Both use the radio-button-like mark. It is not clear if they are one state or two.
- **S11 sub-agent "Finished" uses the same dot as project "Finished" on home.** One word, one mark, two meanings: an agent that ended and a project that ended.
- **S3 "Stop" looks equal in weight to S2.** It is an outlined button with the same text size as the status. For a destructive action that ends a 2-hour run, it has no warning colour. It also sits in a wide empty gap, about 80 px from the avatar, so it looks unaligned.
- **S12 file paths look like code, not like links.** Monospace text with hairline dividers. No icon, no underline, no hover hint before hover.
- **The page opens mid-conversation.** The first visible line is "k = 3 is a hard open problem, not a lead." The user's original prompt is above the fold. A first-time user lands in the middle of an argument and has no anchor for what was asked.
- **Stray dot patterns.** Faint dot fields appear at the left page margin, between the transcript and the side panel, and in bands across the transcript (they get stronger after scrolling or clicking). They look like rendering noise, not like decoration. In light mode they are visible over the transcript text area.
- **The "Waiting on you" variant (Inversion sequences) puts the decision at the bottom.** The approval card ("Spend about $2.40 more …", "Approve $2.40", "Not now") has a red left bar. The status in S2 is red too. But the red status in the top bar and the red card at the bottom are 600 px apart, and nothing points from one to the other.

### 3.3 After interaction: which guesses were wrong

- **S5 is the middle of a long transcript, as I guessed.** Scrolling up shows the original prompt ("Act as an independent researcher …"), several "Thinking", "Searched", "Started 3 agents", "Saved a file", and "Ran" blocks. The page scrolls to the bottom on load and gives no sign that there is more above. The cut-off "lumen" label pressed against the top bar is the only hint.
- **When the first message scrolls off, an empty grey bar remains.** On the Inversion page after Approve or Not now, the top of the transcript shows "You" over a 15 px empty grey strip. It reads as an empty message.
- **S10 "Show all 5" works.** It expands to five findings, including a "Dropped" one in strikethrough. "Dropped" is a third badge style that appears nowhere before you expand. The expanded list pushes "Files" below the fold in the side panel.
- **S10 items are links.** Clicking one highlights the matching row in the transcript with a faint grey band. The band again extends past the column edge. If the row is already visible, the scroll does not move, and the band is the only feedback. I missed it at first.
- **S11 entries do nothing.** Clicking "reader" in the call tree does not scroll, does not open, and does not highlight. I had guessed they would show that agent's work.
- **S12 files do nothing.** Clicking "code/popstack.py" in the side panel does not open a preview, a download, or a scroll. I had guessed they open. They do not.
- **S3 "Stop" asks once.** The first click changes the button to a filled "Stop the run?". The second click stops. That is a good safeguard, but it uses a new word: "run". Everywhere else the object is a "project".
- **Stop writes a message in my name.** After the second click, the transcript shows "You: Stop." I did not type that. Then lumen replies "I stopped at your request. Everything recorded so far is kept." Only this reply answers my earlier question about what Stop costs. The answer comes after the action.
- **After Stop, the status changes to "Stopped" with a hollow ring.** "2 h 14 min elapsed" becomes "stopped just now". The input helper changes to "This project has ended. A message starts it again from where it stopped." So the reply box is also the restart control. Nothing else on screen says so.
- **Approve and Not now also post a message in my name.** "Approve $2.40" posts "You: Approved: spend about $2.40 on n = 13 and 14." The card disappears. The status changes from red "Waiting on you" to "Running", and "waiting 2 h" changes to "2 h 01 min elapsed". The cost stays $0.18, which is correct, but the approved $2.40 is not shown anywhere as pending.
- **Sending a reply works and shows "Queued. lumen reads it at its next step."** That matches S9's helper text. In dark mode the input then gets a thick white double focus ring. It is much heavier than any other element on the page.
- **The "Projects" breadcrumb returns to home.** As guessed.
- **"Attach" in the reply box opens a file picker.** As guessed.

---

## 4. Cross-page problems

- **One status vocabulary, three visual systems.** Status dots on home rows, status dots in the session top bar and call tree, and finding badges ("Open question", "Confirmed", "Dropped") all use different shapes. Two of the dot shapes (Running solid frame, Finished) are nearly identical. The badges look like buttons.
- **"Project", "run" and "session" are all on screen or in the URL for one object.** The page file is session.html, the heading says project, the Stop confirmation says run.
- **Dead links on two of three pages.** "Docs" (landing) and "LZ" (home, session) open `#`.
- **The hover band on clickable rows overshoots the column edge** on home rows, on the home findings, and on the session transcript highlight.
- **The landing page promises a sign-in step that does not exist, and drops the mode the user chose.**
