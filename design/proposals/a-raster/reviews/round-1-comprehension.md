# First-time comprehension review: landing, home, session

Method: Playwright, chrome-headless-shell, 1440x900, light and dark color scheme. I judged only what the screen shows. I did not read the HTML, CSS or JS. Screenshots are in /tmp/lumen-shots/rev/.

Light and dark have the same layout and the same problems. Dark mode adds no new information and removes one: the landing sphere has no floor shadow in dark mode.

---

## 1. Landing (landing.html)

### 1.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| L1 | Top left, "lumen" | Product wordmark | Brand, probably a link home | sure |
| L2 | Top right of centre, "Docs" | Docs link | Product documentation | sure |
| L3 | Top right corner, "Sign in" | Sign-in link | Log in to an account | sure |
| L4 | Right half, large dotted sphere with dotted floor ellipse | Halftone illustration | Decoration, or a metaphor for "lumen" (light) | guessing |
| L5 | Left, lower half, 3-line headline "Now you can do any frontier work. Just start." | Hero headline | Value statement | sure that it is a headline; no idea what "frontier work" means here |
| L6 | Under headline, "Free exploration" (dark) and "A starting point" (grey) | Two-option toggle or tabs | Choose a mode for the input | guessing |
| L7 | Input row: "+", placeholder "Name a field, or leave it open.", black arrow button | Prompt input with submit | Start something by typing | sure it is an input; no idea what to type |
| L8 | "+" at the left of the input | Attach or add button | Attach a file? Add a second item? | guessing |
| L9 | Bottom left, small grey "lumen (lm), the SI unit of luminous flux." | Footnote | Explains the name | sure |

### 1.2 What I could not tell apart, wrong weight, and why

- The page does not say what the product is. No word on the screen says "agent", "AI", "research" or "mathematics". "Frontier work" can mean science, software, business or anything. The only verb is "start", and the input does not say what starting produces.
- "Name a field, or leave it open." "Field" can mean a research field or a form field. I read it as a form field first, which makes the sentence circular.
- L6 does not look like a control. "Free exploration" and "A starting point" are two plain text labels with no underline, border or background. The only difference is grey versus black. A first-time user can read them as a caption, not as two choices. Neither label says what the mode does.
- L8 ("+") has no label and no tooltip. It is the same weight as the submit arrow, so the two controls look like a pair of equal actions.
- L4 takes half the screen and has more visual weight than everything else together. It carries no information. The input (L7), which is the only real action, sits low on the page, under the fold line of the eye, and is thinner than the headline.
- L2 "Docs" floats about 280 px left of "Sign in" with no visual grouping. It reads as a separate, more important item than it is.
- L9 is a pun explanation, placed in the footer where legal or contact text usually goes. It costs nothing, but it is the only text that explains anything, and it explains the name, not the product.

### 1.3 After interaction: wrong guesses

- L4 is not static. The light spot on the sphere follows the mouse pointer, and the floor shadow moves. Switching L6 to "A starting point" also moves the light to the right side. So the sphere is a mode indicator as well as decoration. Nothing on screen tells the user this. A change in the illustration is not a readable signal that the mode changed.
- L6 is a toggle. Clicking "A starting point" changes the placeholder to "Paste a paper, a repo or a question." This second placeholder is the first text on the page that tells me what the product accepts. It is hidden behind the less prominent option.
- L8 "+" only shows a grey hover background. Clicking it does nothing visible. No file picker, no menu.
- L7 submit: I typed "combinatorics" and pressed the arrow. The page went to a session titled "Pop-stack fertility / free exploration", which is already "Finished", costs $0.94 and took 2 h 14 min. My text appears nowhere. The user gets someone else's finished work as the answer to their first input. Without an account, this is the most confusing moment in the whole flow.
- L2 "Docs" goes to "#". Nothing happens.
- L3 "Sign in" goes straight to the home page with no sign-in step. Then the user is suddenly "LZ" with three projects.
- Scrolling does nothing. The page has no second screen that explains the product.

---

## 2. Home (home.html)

### 2.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| H1 | Top left, "lumen" | Wordmark | Link home | sure |
| H2 | Top right, "$0.71 of $200" | Spend against a budget | Shows money used out of a limit | guessing (which period? monthly? per account? prepaid credit?) |
| H3 | Top right corner, black square "LZ" | User avatar / account menu | Account settings, sign out | sure that it is the account; guessing that it opens a menu |
| H4 | Left label "New research" + toggle + input | Composer for a new project | Start a new research run | sure |
| H5 | Left label "Projects 3" | Section heading with count | Labels the list | sure |
| H6 | List of 3 rows: bold title, status chip, 2-line grey summary | Project list | Open an existing project | sure |
| H7 | Status chips: red square "Waiting on you", half-filled square "Running", filled square "Stopped" | Run state | Show which project needs attention | sure for "Running" and "Stopped"; guessing for "Waiting on you" |
| H8 | Far right of each row: "$0.18 / 2 h ago" | Cost and last activity | Per-project spend and recency | guessing (is "2 h ago" the start time or the last update?) |
| H9 | Bottom third of screen, empty | Nothing | Nothing | sure |

### 2.2 What I could not tell apart, wrong weight, and why

- "Waiting on you" is the only red item on the page, which is correct. But the row gives no hint about what I must do: no question, no button, no "approve". The summary text under it states a result ("The commonly cited sequence ... is wrong"), not a request. So the red label promises an action that the row does not show.
- The status glyphs are small squares that differ only by fill: empty, half, full, red. "Stopped" uses a filled black square. On the session page the same filled black square means "Finished", "done" and "Confirmed". One glyph means four things. "Running" uses a half-filled square, which reads as "half done", not as "in progress". Nothing moves or pulses on the "Running" row, so it looks as static as "Stopped".
- H2 and H8 use the same format ($0.xx) and the same right-hand position. The header total and the row costs look like the same kind of number. "of $200" is grey and small, so the budget limit is easy to miss.
- The cost column (H8) is about 350 px to the right of the summaries, with empty space between. At 1440 px the eye does not connect "$0.41" to "Pop-stack fertility" without a scan across the gap.
- The summaries (H6) are grey, smaller than the titles, and they contain the real result of each project. They look like secondary metadata but they carry the most information on the page.
- H4 repeats the landing composer with the same "+", the same unlabelled toggle and the same ambiguous placeholder. All the landing problems repeat here.
- The two horizontal rules (under the header and above Projects) are the same weight. So the header, the composer and the list look like three equal bands. The project that is waiting on me does not stand out from the composer above it.
- H9: the bottom 300 px is blank. Not a problem by itself, but it confirms that the page has no other content (no history, no files, no help).

### 2.3 After interaction: wrong guesses

- H2 "$0.71 of $200" is a link (it underlines on hover). It opens the session page, not a billing page. I expected billing or usage.
- H3 "LZ" goes to "#". Nothing opens. It is not a menu.
- H6: the whole row is clickable (summary, status chip, cost and time all show a pointer cursor). But hover only underlines the title, so the user can think only the title is a link.
- All three rows open the same session: "Pop-stack fertility". Clicking "Dyck-path tunnels" (Stopped) opens "Pop-stack fertility", which is "Finished".
- The data on the two pages contradicts itself. On home, "Pop-stack fertility" is "Running", $0.41, 41 min ago, "We have it to n = 10". In the session it is "Finished", $0.94, 2 h 14 min, and it is at n = 11. The header total $0.71 is the sum of the three rows ($0.18 + $0.41 + $0.12), but the session alone says $0.94. A user who notices this stops trusting every number on both pages.
- The session also shows "Stack-sorting depth" and "Dyck-path tunnels" as lines inside the Pop-stack session ("Three of the four lines are already solved, so I am dropping them"). So on home they look like three separate projects, but in the session they look like sub-lines of one run. I could not tell which model is correct: is a "project" a run, or a line inside a run?
- The empty submit (no text) goes to session.html?q= and again opens the finished Pop-stack session. No validation and no feedback.
- Keyboard focus is visible on "LZ" (thick outline). That part works.

---

## 3. Session (session.html)

### 3.1 Regions before interaction

| # | Where | What I think it is | What I think it is for | Sure? |
|---|---|---|---|---|
| S1 | Top bar: "lumen", "LZ" | Global header | Navigation, account | sure |
| S2 | Second bar left: "Pop-stack fertility / free exploration" | Breadcrumb or title + mode | Says which project and mode | guessing (is "/" a breadcrumb separator or "title / subtitle"?) |
| S3 | Second bar right: filled square "Finished", "$0.94", "2 h 14 min" | Run status, cost, duration | Summary of the run | sure for status and cost; guessing that "2 h 14 min" is total duration |
| S4 | Main column, left gutter labels "You / Thinking / Run / Reply / Record" | Transcript of the conversation, typed by step | Show what the user said and what the agent did | sure |
| S5 | "Run" row with grey code block and "2 m 41 s" | Command the agent ran, with output and run time | Show evidence | sure |
| S6 | "Record" row: two lines, "finding / holds at n = 11 / confirmed" and "finding / induction on descents / open" | Things the agent saved in this turn | Log of results added to the findings list | guessing |
| S7 | Bottom of main column: "+", placeholder "try the induction, and tell me if it stalls", black arrow | Message composer | Send the next instruction | sure |
| S8 | Right column top: "Call tree" with "lead" and 3 indented children, each "done" | Agent hierarchy | Show the main agent and its sub-agents and their state | guessing ("call tree" is a programmer term; a first-time user may not know that "lead", "reader" and "compute-perm" are agents) |
| S9 | Right column: "Findings 5" with status-tagged cards (Dropped, Confirmed, Open, ...) | Results ledger for the project | Show what is known, confirmed and still open | sure |
| S10 | Right column, below the fold of the panel | Unknown | Unknown | no idea (the last visible line, "Confirmed", is cut at the bottom edge, which is the only hint that more exists) |

### 3.2 What I could not tell apart, wrong weight, and why

- S6 "Record" and S9 "Findings" show the same kind of thing with different words. "holds at n = 11" in Record is "The identity maximises at n = 11" in Findings. "Record" lowercase status words ("confirmed", "open") match the Findings capitalised words ("Confirmed", "Open"). The user cannot be sure that they are the same items, because the titles differ.
- S3 says "Finished", and every node in S8 says "done". But the Reply directly above the composer says "I am writing that up now", and the Findings card says "The general case is being written up". The composer suggests that I continue a live conversation. The screen contradicts itself about whether work is happening.
- The same filled black square marks "Finished" (S3), "done" (S8), "confirmed" (S6) and "Confirmed" (S9). It also means "Stopped" on home. The user cannot learn the glyph, because it does not mean one thing.
- "Thinking" text is grey and small. "Reply" text is the largest text on the page, larger than the user's own message ("You"). The user's instruction looks less important than the agent's answer, and much less distinct from it. The gutter labels You/Thinking/Run/Reply/Record all use the same weight and size, so the speaker change (user versus agent) has the same visual weight as a step change (thinking versus running).
- The main column and the right panel scroll independently. Neither shows a scrollbar in this browser. The conversation opens scrolled to the bottom, so the first message and the whole history above are invisible with no indicator. The right panel shows a cut-off "Confirmed" label at the bottom edge as the only sign that it scrolls.
- S8 sits at the top of the right panel, above Findings. It is static (all "done") and has less value than Findings for a user who wants the result. Its position gives it more weight than it deserves.
- The S2 title row and S3 status are in a band that looks like a second header. The thick black rule under it stops at the right panel, and the right panel has its own thick rule. Two parallel header lines make the right panel look like a separate page.
- Big empty gap (about 140 px) between the main column and the right panel. It separates the conversation from its findings more than necessary.
- "+" in the composer again has no label.

### 3.3 After interaction: wrong guesses

- The session plays as an animation on load. For about 1 second the main column is empty, then rows fade in one by one, in order. A first-time user who opens the page sees a blank area next to a full right panel and can think the page broke. The animation also makes a finished run look as if it is happening live, which adds to the "Finished" versus "writing up now" contradiction.
- Scrolling up the main column shows the full history: the first "You" message, "Search" rows (arxiv, oeis sources), "Delegated 3 in parallel", "Save file code/popstack.py +28", two "Run" rows, two "Reply" rows, two "Record" rows. So the transcript has more step types (Search, Delegated, Save) than the first screen shows. The history is the most informative part of the page and it is hidden above the fold with no hint.
- The history explains S8: "Delegated" shows that reader, compute-perm and compute-dyck are sub-agents of the lead. The Call tree is only readable after you scroll the main column, which is the other panel.
- S10, below the Findings, is a "Files 7" list (research/literature.md, code/popstack.py, results/fertility_n11.csv and others). Files are not clickable and show no hover. I expected them to open.
- Call tree nodes: no hover, no click result. I expected a click on "compute-perm" to filter the transcript or show its work.
- Findings cards: no hover, no click result. "3-stack-sortable is A134664" does not jump to the run that proved it.
- Record rows: no click result.
- The status "Finished" shows no hover and no click result.
- S7 composer: I typed text and clicked the arrow, then I pressed Enter. Nothing happened. No new "You" row, no error, no "sending" state. The text stays in the box. The composer looks fully live but does nothing. In dark mode the focus ring around the composer overlaps the bottom rule and clips the arrow button, so the composer looks broken when focused.
- S7 "+": no visible effect.
- S2 title "Pop-stack fertility" is a link to home. I expected it to stay on the project. The "lumen" wordmark also goes to home, so two different-looking items do the same thing.
- landing.html "submit" and home "submit" both pass ?q= to this page, but the page ignores it. Every entry point lands on this one finished session.

---

## 4. Problems that cross all three pages

1. The product never states what it does on the landing page. The user learns "this is a research agent for mathematics" only after they reach the session page and read the transcript.
2. One status glyph (filled black square) means Stopped, Finished, done and Confirmed. Red square is the only distinct state.
3. The mode toggle ("Free exploration" / "A starting point") does not look like a control on any page, and only the second option has a placeholder that explains what to type.
4. Unlabelled "+" on every composer, with no effect.
5. Numbers disagree between home and session (status, cost, duration, n). The budget link goes to a session, not to billing.
6. Every navigation path ends at the same finished session, whatever the user typed or clicked. A first-time user cannot form a model of "my project" versus "a demo project".
7. Inside the session, three regions (Record, Findings, Call tree) show overlapping state with different words, and two of them sit in a separate scroll container with no scrollbar.
