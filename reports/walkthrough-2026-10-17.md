# Walkthrough, 17 Oct 2026

Every feature used as a researcher would, on staging and on a local server
(Claude Haiku 5.5 through Anthropic's OpenAI-compatible endpoint, Docker
sandbox). Each line: what was tried, what happened, the cause, the fix.

Status: **fixed** (merged or on the open branch), **ok** (worked as
expected), **open** (found, not fixed here), **todo** (not yet tried).

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
| A14 | Staging, gpt-4.1-nano, fixed points by n | **open** | The sandbox ran and the file was saved, but the table was wrong (n = 5, k = 2 gave 40, not 20) and the lead said it matched A008290 without searching it. The prompts ask for this check; nano does not do it. Haiku did. | Model choice; kept on gpt-4.1 by decision. |
| A15 | Stop during a run | **ok** | Arms on the first click, stops on the second; the tree says Stopped. | |
| A16 | Steering at the end of the turn | **ok** | The timing switch and its hint change together. | |
| A17 | Staging, gpt-4.1-nano, the first 12 Catalan numbers | **open** | Wrote 16669 for 16796 and said OEIS confirmed it; the search result beside it lists the right term. Same cause as A14. | Model choice. |

## Files

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| F1 | Files panel after a run that saved files | **fixed** | The panel read /mnt/output, agents wrote to /mnt/workspace. | Prompt: keep results in /mnt/output (#99). Now lists what was kept. |
| F2 | Opening a file from the panel | **fixed** | Files were named, never linked. | Each file opens from steering's files route (#99). |
| F3 | Attaching a file | **fixed** | No upload route existed; /mnt/upload was always empty; the field promised "a paper or a repo". | `PUT /api/projects/:id/upload/:name`, Attach in the session field, the next message says where the file is (this branch). Tested: a CSV of Catalan numbers was read and identified as A000108. |
| F4 | Attaching on Home or the landing | **open** | No project exists yet to attach to. The placeholder no longer promises it. | Attach in the session. |
| F5 | A file name in Chinese ("数据 表 v2.csv") | **fixed** | The safe-name rule kept ASCII only; it became "v2.csv". | Letters and digits of any script stay (this branch). |
| F6 | A file over 10 MB | **fixed** | The hint said "Request body is too large". | The field says the 10 MB limit before sending (this branch). |
| F7 | Opening a kept table | **fixed** | Every file was served as octet-stream, so the browser downloaded it. | Text types open as plain text with nosniff; others download (this branch). |
| F8 | Staging files after a deploy | **fixed** | Project files lived on the machine's disk, which every deploy replaces: a saved table was gone after the next merge. | A 1 GB Fly volume at /data, `LUMEN_VOLUME_ROOT=/data/projects`. |
| F9 | A file the lead called saved | **fixed** | Readers save to the session's scratch by default; the panel listed only /mnt/output, so the file was nowhere to be seen. | The files route lists one session's workspace with `?session=`, and the panel shows it under "Scratch, this session only". |

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

## Phone, 390 px, dark and light

| # | Scenario | Result | Cause | Fix |
|---|---|---|---|---|
| M1 | A running session and a finished one | **ok** | No sideways scroll, no page errors; the bar keeps the state, spend and Stop. | |
| M2 | Projects with none yet | **fixed** | "Your next discovery starts here", a paragraph, and a "Start your first project" button above the new-project field. | "No projects yet."; the field is the one way to start. |
| M3 | A delegated reader in the stream | **fixed** | The lead writes the reader's whole brief into its title, so one row was half a screen. | Three lines; the reader opens in full. |
| M4 | The bar over the scene | **fixed** | Stars drifted through "spent" and the elapsed time. | The bar is quiet, so particles fade round it. |

## Still to try

- Approvals and top-ups with a billing database (staging).
