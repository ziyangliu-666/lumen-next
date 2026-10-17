# Walkthrough, 17 Oct 2026

Every feature used as a researcher would, on staging and on a local server
(Claude Haiku 5.5 through Anthropic's OpenAI-compatible endpoint, Docker
sandbox). Each line: what was tried, what happened, the cause, the fix.

Status: **fixed** (merged or on the open branch), **ok** (worked as
expected), **open** (found, not fixed here), **todo** (not yet tried),
**deferred** (left for later by the owner's decision).

## Agent behaviour (autoresearch)

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| A1 | A seeded question (Dyck paths by peaks and double rises) | **fixed** | The lead listed an empty workspace twice and asked the user to upload data. | Lead prompt: work, do not ask; search before computing (#99). |
| A2 | A follow-up turn ("compute it yourself") | **fixed** | A new turn passed only the new message; the lead had forgotten the question and generated random sample data. | Kernel `say` gives the turn the conversation so far (#99). |
| A3 | Results reported as saved | **fixed** | The lead said a file was saved when no command had run (staging had no compute). | Prompts: report only what tools returned (#99); staging runs a sandbox (#100). |
| A4 | Fan-out | **fixed** | One reader per delegate call, one after another, for steps of one task. | Prompt: independent tasks in one delegate call (#99). Now 2 to 3 readers in parallel. |
| A5 | Checking a sequence against OEIS | **fixed** | The sandbox has no network; readers guessed A-numbers from memory. | `search` tool, OEIS and arXiv, drawn as Searched rows (#99). |
| A6 | Python in the sandbox | **fixed** | The image was bare Alpine; every script failed with `python3: not found`. | `python:3.12-alpine3.20` (#99). |
| A7 | A reply past the length limit | **fixed** | The lead enumerated by hand, hit 4,000 tokens twice, and the page showed an empty reply. | Retry once asking to delegate or answer short; 8,000-token limit; keep the partial text (#99). |
| A8 | Free exploration (empty field) | **ok** | Picked a specific open question (the Stanley-Wilf limit of 1324), searched, reported bounds and what it had not checked. | |
| A9 | Steering while running ("keep it to permutation patterns") | **ok** | Heard and followed. | |
| A10 | Long session, four turns (spec prompt, push n, second implementation, summary) | **ok** | Chose consecutive-pattern involutions, searched, computed to n = 14, ran 3 readers in parallel for independent implementations, caught a reader's pruning bug and its own transcription slip, summarised from memory in the last turn. | |
| A11 | arXiv results | **fixed** | `all:<words>` is an OR across all archives; an involutions search returned gamma-ray astronomy. | Every word required, in `cat:math.*`, falling back to any word (this branch). |
| A12 | Delegating "read the full text of arXiv X" | **fixed** | Nothing can read beyond an abstract; the reader could only fail. | Tool description and prompt say so (this branch). |
| A13 | A tool error on a missing file | **fixed** | Node's message named the host folder (`/app/.data/<project>/output/...`) to the model and in the trace. | Errors say the /mnt path the agent asked for (this branch). |
| A14 | Staging, gpt-4.1-nano, fixed points by n | **fixed** | The sandbox ran and the file was saved, but the table was wrong (n = 5, k = 2 gave 40, not 20) and the lead said it matched A008290 without searching it. The prompts ask for this check; nano does not do it. Haiku did. | Rerun on gpt-4.1-mini: the table to n = 7 is right (n = 5, k = 2 is 20), A008290 named, the CSV kept. Staging's default is now gpt-4.1-mini; nano stays in the picker. |
| A15 | Stop during a run | **ok** | Arms on the first click, stops on the second; the tree says Stopped. | |
| A16 | Steering at the end of the turn | **ok** | The timing switch and its hint change together. | |
| A17 | Staging, gpt-4.1-nano, the first 12 Catalan numbers | **fixed** | Wrote 16669 for 16796 and said OEIS confirmed it; the search result beside it lists the right term. Same cause as A14. | Rerun on gpt-4.1-mini: all twelve right, checked by a real OEIS search, the file kept. |
| A22 | Replies on gpt-4.1-mini | **fixed** | Both runs ended "If you want, I can provide…". | The lead prompt: end with what is still open, not an offer. |
| A23 | Staging, gpt-4.1-mini, best known bounds on the Stanley-Wilf limit of 1324 | **ok on Haiku; model limit on gpt-4.1-mini** | Two arXiv searches; the upper bounds it gave are real (16, arXiv:1111.5736; 13.93, arXiv:1207.2379), but it missed the newer 10.27 to 13.5 and said no lower bound exists for 1324 while quoting one for 4231, its reverse. The results had no dates. | arXiv results carry their year; the lead prompt asks for more than one search on a best-known question, the year of each result, the newest named, and treats a pattern and its symmetries as one.. Rerun after the prompt change, still on gpt-4.1-mini: still two searches, 2012 still called the newest, an upper bound listed as a lower one. arXiv recall was part of it: with every word required, the search found four papers, and none of three queries tried reaches arXiv:1711.10325 (2017, 10.27 to 13.5). The list is now filled with any-word papers to eight, which brings in math/0502504 (the 4231 lower bound). The rest is the model: the newest bounds need a search with other words, which mini does not try. Same question locally on Claude Haiku 5.5 after these changes: five searches; 13.5 upper and 10.27 lower from arXiv:1711.10325 (2017), a 2026 paper (arXiv:2608.20292) raising the lower bound to 10.41, abstracts kept apart from what it recalled. The tools reach the papers; mini does not search far enough. A stronger model in the picker is the remedy. With the synonym search (a Stanley-Wilf query also runs as "growth rate"), mini reached arXiv:1711.10325 in one search and gave its 10.271 lower bound, but kept 16 as the upper bound where the same paper proves 13.5, and missed the 2026 lower bound. It searched once; the rest is the model. Staging stays on gpt-4.1-mini by the owner's decision (17 Oct 2026); the tool side is done. |
| A24 | Staging, an attachment sent just after the project starts | **fixed** | The lead's first read of /mnt/upload came before the file landed: "not found, please re-upload". | A read in /mnt/upload waits up to 15 s for a file still uploading. Rerun with the upload 3 s late: the read waited, and the file was named A001003. |
| A18 | Checking computed Motzkin terms to n = 16 against OEIS | **fixed** | The search tool gave the model only the first 16 terms of each entry, so the reader could not check n = 16 and said so. | The whole data line goes to the model. |
| A19 | The lead lists /mnt to look around | **fixed** | /mnt is not a scope, and the answer was "path is outside /mnt". | A listing of /mnt names the three folders and what each holds. |
| A20 | A PDF attached, "check its claim for n up to 12" | **ok** | After F13: the lead delegated the text extraction, a reader decompressed the PDF streams with zlib, a second reader counted 321-avoiding involutions to n = 12 and matched A001405. It said which citation it had not checked. | The sandbox has no PDF library; a reader has to decode the file by hand. |
| A21 | Steering reader 1 mid-run ("also print n = 13") | **ok** | The reader heard it at its next step. Brute force hit the 30-second command limit at n = 12; it tried a background job, which the sandbox does not keep, then used a memoised count checked against the brute-force values and said so. | |

## Files

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| F1 | Files panel after a run that saved files | **fixed** | The panel read /mnt/output, agents wrote to /mnt/workspace. | Prompt: keep results in /mnt/output (#99). Now lists what was kept. |
| F2 | Opening a file from the panel | **fixed** | Files were named, never linked. | Each file opens from steering's files route (#99). |
| F3 | Attaching a file | **fixed** | No upload route existed; /mnt/upload was always empty; the field promised "a paper or a repo". | `PUT /api/projects/:id/upload/:name`, Attach in the session field, the next message says where the file is (this branch). Tested: a CSV of Catalan numbers was read and identified as A000108. |
| F4 | Attaching on Home or the landing | **fixed** | No project existed yet to attach to. | Attach before the first message (E3): the files go to the new project once it is created. |
| F5 | A file name in Chinese ("数据 表 v2.csv") | **fixed** | The safe-name rule kept ASCII only; it became "v2.csv". | Letters and digits of any script stay (this branch). |
| F6 | A file over 10 MB | **fixed** | The hint said "Request body is too large". | The field says the 10 MB limit before sending (this branch). |
| F7 | Opening a kept table | **fixed** | Every file was served as octet-stream, so the browser downloaded it. | Text types open as plain text with nosniff; others download (this branch). |
| F8 | Staging files after a deploy | **fixed** | Project files lived on the machine's disk, which every deploy replaces: a saved table was gone after the next merge. | A 1 GB Fly volume at /data, `LUMEN_VOLUME_ROOT=/data/projects`. Checked on staging: a file saved at 10:29 was still listed after the 10:40 and 10:46 deploys. |
| F9 | A file the lead called saved | **fixed** | Readers save to the session's scratch by default; the panel listed only /mnt/output, so the file was nowhere to be seen. | The files route lists one session's workspace with `?session=`, and the panel shows it under "Scratch, this session only". |
| F10 | Seeing a file just attached | **fixed** | The panel listed kept results and scratch, never /mnt/upload, so nothing showed that the file had arrived. | An "Attached" group; each attachment opens like any other file. |
| F11 | A folder the agents wrote (/mnt/output/motzkin/) | **fixed** | A folder was a name that did nothing; the script and table inside it were out of reach. | A folder opens in place and lists its files. |
| F12 | Saving a file again near the quota | **fixed** | The old copy counted against the quota, so replacing a file the same size was refused. | A write does not count the copy it replaces, for agents and attachments. |
| F13 | Reading an attached PDF | **fixed** | read_file decoded every file as UTF-8, so a PDF reached the model and the trace as replacement characters. | A binary file is named with its size, and the agent is told to read it with run. |
| F14 | Editing files: an attachment replaced under the same name, a kept file changed by an agent | **ok** | The next turn read the new attachment (Catalan, then Motzkin). Asked to extend and rename the header of a copy, the agent wrote /mnt/output/edit.csv with two more terms and the new header, and left the upload as it was. Both checked through the files route. | |

## Page and navigation

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| P1 | Opening a session on staging | **fixed** | Stuck on Connecting, field disabled: the socket opened before the snapshot and its state was dropped. | Keep the last socket state (#99). |
| P2 | Clicking a project row | **fixed** | Only the title text opened it. | The whole row opens it (#99). |
| P3 | Front page when signed in | **fixed** | The wordmark led only to Projects. | The wordmark leads to the front page; the account shows in the corner (#99). |
| P4 | Sign-in page | **fixed** | A sphere cut at the corner beside an empty sky. | A sign-in shot of the scene (#99). |
| P5 | Opening a session link signed out | **fixed** | The server's "sign in first" as a heading, and a paragraph of explanation. | "Sign in to open this session" and one button; after signing in, the projects page goes on to the session (this branch). |
| P6 | Search, status filter, Refresh, account menu, back and forward | **ok** | | |
| P7 | "New activity since your last visit" right after a project you just ran | **fixed** | The visit was marked when the project opened, before the run ended. | A run that ends on screen marks a visit (this branch). |
| P8 | Settings: Wallet, Account, Keys; sign out | **ok** | Each tab says what this server has; sign out lands on the front page with Sign in. | |
| P9 | A long question as a project title on Projects | **fixed** | The title was the first 120 UTF-16 units, so it ended mid-word ("and save the t") and could split an emoji. | Cut at a word boundary within 120 characters, marked with an ellipsis. |
| P10 | The ledger on Wallet, by call | **fixed** | The lead's calls said "openai" and the readers' said "model: …", so one session read as two kinds of spend. | Every model call is "model: <name>". |
| P11 | A reply with a Markdown table or a fenced script | **fixed** | Only paragraphs, lists and headings were drawn, so a table of terms became one line of pipes. | Tables and fenced code are drawn, still without HTML from the model. |
| P12 | Reloading the page during a run | **ok** | The run, its spend and Stop came back; the field stayed usable. | |
| P13 | Steering a reader: the timing switch | **fixed** | With reader 1 shown, the switch said "lumen reads it". | It names the task shown: "reader 1 reads it". |
| P14 | Stopping a running project from Projects | **fixed** | The row said Stopped, then Failed after a refresh. The stop landed during a model call; the call came back asking for readers, the delegation was refused because the task had stopped, and that error marked the task failed. | An error in a turn that was stopped leaves the task stopped. |
| P15 | Activity after stopping a project from Projects | **fixed** | The row then said "New activity since your last visit: 1 session ended", although the person ended it. | A stop from Projects marks a visit. The call in flight is charged after it and still shows as new spend. |
| P16 | Work after a stop | **fixed** | Readers went on for 9 s after a stop: a model call, a command, a search, another model call. Nothing told the worker. | The worker asks whether its task was stopped before each model call and each tool. After the fix the lead stopped 0.7 s after the request, with only the call in flight charged. |
| P17 | The field, on every page | **fixed** | One thin line with a black block beside it read as a form, not as a place to write to lumen. | A message box like chat products draw: two lines of text, Attach and the timing switch at its foot, send inside the box and dimmed until there is text, attachments as chips. |
| P18 | The small text | **fixed** | Lines explained what the page already showed: "Your research starts here.", "Your question is ready. Press the arrow to start.", "Ended. A reply starts a new turn.", "Read at its next step.", "Sign in before starting. Your question is saved in this tab.", and an instruction as the placeholder. ChatGPT and Claude show one question as the placeholder and no line under the field. | The placeholder asks "What should lumen work on?"; the person always asks: an empty field does not send, and free exploration has no control ("Let lumen choose a question" was unclear); the line under the field is for status and errors only; the landing paragraph is gone; signed out, the hint is "Sign in to start." |
| P19 | Projects over the scene | **fixed** | The list column was 85 % black and the sphere a speck behind the right panel, so the page was a black box. | The column fades to the scene below the list, and the home shot puts the sphere there. |
| P20 | The timing switch in the session field | **fixed** | "lumen reads it: At its next step / At the end of its turn" was not understood. | Removed. A steer lands at the next step; the server still takes both. |
| P21 | Actions on a turn | **fixed** | An answer had no way to copy it, link to it or ask again; a message could not be edited. | Under an answer: Copy (Markdown), Copy link, and on the latest answer Regenerate. On the latest message: Edit, which puts it back in the field. Both start a new turn, because the trace keeps every turn. |
| P22 | Quiet zones | **fixed** | data-quiet was set on the bar and the sign-in column, but the scene never read it. | The scene paints the paper back over each quiet element, with a soft edge. |
| P23 | A tab left open across a deploy | **fixed** | On staging, an open tab still ran the old app (old field, old copy) after #110 was live; only a reload showed the new one. | The bar offers "Reload for the new version" when the served bundle differs, checked on focus and every five minutes. Tested by rebuilding under an open tab. |
| P24 | Settings copy | **fixed** | Wallet, Approvals, Top-ups and Keys were paragraphs of policy. | One line each. The facts a person must know stay: running work can pass the cap, an approval does not raise it, no refunds, and the Keys disclosures its test requires. |
| P25 | Sign up from the bar | **fixed** | Sign up opened account creation, but "?mode=signup" stayed in the address after it. | The parameter is read once and removed. |

## Phone, 390 px, dark and light

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| M1 | A running session and a finished one | **ok** | No sideways scroll, no page errors; the bar keeps the state, spend and Stop. | |
| M2 | Projects with none yet | **fixed** | "Your next discovery starts here", a paragraph, and a "Start your first project" button above the new-project field. | "No projects yet."; the field is the one way to start. |
| M3 | A delegated reader in the stream | **fixed** | The lead writes the reader's whole brief into its title, so one row was half a screen. | Three lines; the reader opens in full. |
| M4 | The bar over the scene | **fixed** | Stars drifted through "spent" and the elapsed time. | The bar is marked quiet, and the scene fades behind quiet elements. The first fix only set the attribute: nothing read it until P22. |

## Accounts and billing (local server with Postgres and accounts)

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| B1 | Cap $0.002, a project with three readers | **ok** | Spent $0.0085 with no approval: the check runs before a turn and at each delegation, spend was under the cap at both, and running work may pass it, as Wallet says. | |
| B2 | A follow-up turn over the cap | **fixed** | "Not run: the budget could not be checked." The kernel gave billing the whole conversation as the reason, and billing refuses one over 2,000 characters; the guard's error was swallowed without a log. A first question over 2,000 characters failed the same way. | The budget is told the person's latest words, cut to 300 characters; a failed check is logged with its cause. Now the turn waits, Wallet lists the request, and Approve once resumes it to the end. |
| B3 | The field while a task waits for approval | **fixed** | It said "This task has finished". | "Nothing to steer right now". |
| B4 | Test-mode top-up | **ok, Stripe page deferred** | Walked through the page on a local server with Postgres, with Stripe's two network calls replaced by a stand-in (a harness outside the repo): Add USD 5 created the order; the page refused the stand-in's local checkout address ("Invalid checkout destination"), as it must for anything but checkout.stripe.com; the paid webhook raised the cap from $1 to $6 and listed the receipt; the return address said "USD 5 added to your cap."; the cancel address said "Checkout cancelled. Nothing was added." The 123 billing tests pass against Postgres. | Only Stripe's own hosted page is unvisited: deferred by the owner's decision (17 Oct 2026) until there is a Stripe test-mode key. |
| B5 | Reject an approval request | **fixed** | Reject works: the turn says "Not run: approval rejected.", the task stops, and the field takes a new turn. Wallet then said "Rejected. Resuming…". | "Rejected. Stopping the task…", then "Rejected. The task stopped." Approve reads "Approved. Resuming…". |
| B6 | Keys: save a key, run a turn with it, remove it | **fixed** | Save hides the key and says it is saved; a refused key stops the turn with no second call on the platform key; removal works. The stop said OpenAI's own message, a masked key and a link to OpenAI. The notices said the same thing twice. | "Stopped: the model key was refused. If you saved an OpenAI key, replace it in Settings, Keys." and "Key saved." / "Key removed." Note: the personal key goes to api.openai.com whatever the server's model URL; the test sent a random string there. |
| B7 | A cap reached at a delegation, then Approve once | **fixed** | The readers ran after the approval, but the lead never came back: its turn had ended at the block with "Stopped: the budget does not allow it", so the session read Finished with no answer. Wallet named the request "delegate 2"; Sessions said Running while it waited. | After an approved fan-out the parent gets a turn with each reader's report, not asked again; waiting is no longer written as a stop; the request reads "Open 2 readers: <their tasks>"; Sessions shows the lead's own state. Tested: the lead read both tables, checked A001006 and answered. |

## Entry page against ChatGPT, Claude and Mistral

| # | What they have | lumen | Result |
|---|---|---|---|
| E1 | Starter cards ("Try") | Three research questions under the field when there are no projects. A card fills the field and does not send. | **fixed** |
| E2 | Recents | Signed in with projects, the last four under the field, with their state, and All projects. | **fixed** |
| E3 | "+" to attach before the first message | Attach on the landing and on New project. The files go to the new project right after it is created, and the question names them. Tested: a CSV attached on the landing was read and matched to A001006. | **fixed** |
| E4 | A greeting for the person | "Good evening, Ada." when signed in; the promise stays for a first visit. | **fixed** |
| E5 | Sign up beside Sign in | On a server with accounts; checked on the local account server. A development server has none to create. | **fixed** |
| E6 | Model picker | LUMEN_MODELS lists the models a new session may choose, the default first, each with a price row or the server does not start. The field shows a picker when there are two or more; the session keeps its choice (migration 016) and the bar names it. Staging offers gpt-4.1-nano (default) and gpt-4.1-mini. Tested: one session on each model, each call sent to its own. | **fixed** |
| E7 | Voice input | A microphone in the field where the browser has speech recognition (Chrome, Edge, Safari). The words go into the field; nothing is sent. Checked with a stand-in recogniser. | **fixed** |
| E8 | Several chats in a project | Sessions in the session page's panel, newest first, and New session, which turns the field into the first question of a new session. Tested: a second session read the first one's kept catalan.csv; the list goes back to the first. | **fixed** |
| E9 | New session and moving between sessions | **fixed** | New session left this session's conversation on screen above the field, and the Sessions list read as plain text, with the open session barely marked. | New session opens an empty page with "Back to this session"; the list's rows are the call tree's, the open one filled and bold, each opening its session. |
| E10 | The bar in a project with several sessions | **fixed** | The bar named only the project, so every session of it looked the same. | "Projects / <project> / <this session's question>" when there is more than one session. |
| E11 | A reply with formulas, a diagram, a table, an image | **fixed** | The reply renderer was hand-made: LaTeX showed as dollar signs, a mermaid block as its source, and an image as text. | Replies and thinking are drawn by react-markdown with GFM, KaTeX for $…$ and $$…$$, Mermaid (loaded only when a reply has a diagram, strict security), and images of the project's own files (served inline as png, jpeg, gif or webp; SVG stays a download). Raw HTML is never parsed; links are http(s) only; an outside image stays a link. A-numbers and arXiv ids become links to their entries. Tested: a Catalan explanation drew 26 formulas, its table, its diagram and six citation links. Images on a real run: a PNG attached to a session, copied to /mnt/output by a reader and embedded by the lead, loaded in the reply from the files route. Plots drawn in the sandbox need a library it does not have (matplotlib; the sandbox has no network to install one): a larger sandbox image is a deploy decision. |
| E12 | The sources a search used | **fixed** | A search was a table of text: no result could be opened, and there was no telling what had been read. | "Searched OEIS for <query>" and each result as a chip that opens the entry (oeis.org, arxiv.org), four shown and "N more". Rows carry an https link; the server keeps no other. |

## Still to try

- Approvals and top-ups with a billing database (staging).
