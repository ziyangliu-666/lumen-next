# Cold review, 2026-10-17

A fresh agent with no project context reviewed landing, home and session from
an isolated copy (`/tmp/lumen-cold/`). Its whole prompt: the three file paths,
the Playwright browser path, "look at them the way a person would who lands on
them for the first time, and tell me honestly what you think", judge the
screen not the source, do not read other files, answer in English. Its report
follows verbatim.

---

I looked at the three pages in Chromium as a first-time visitor would. I used window widths of 1440, 900 and 390, in light and dark mode. I clicked every control, typed into the inputs, scrolled the panels and used Tab for keyboard focus. I did not read the source.

## First impression

The visual design is strong. The type is precise, the palette is black and white, and the halftone sphere has a light that moves slowly. The pages look calm and serious. The session page is the best of the three. As a picture of an agent that does research, it is more convincing than most products I know. The home page and the session page look like one product, and dark mode works on all three pages.

## Landing page: I do not know what this is

- **The headline promises too much.** "Now you can do any frontier work. Just start." I cannot tell what lumen does, who it is for, or what "frontier work" means. With no other text on the page, the claim reads as hype. One line that names the user and the result would fix this, for example "An agent that does open-ended research in mathematics: it searches, computes and reports".
- **The input asks me to decide before I understand.** The tabs "Free exploration" and "A starting point" have no explanation. The placeholder "Name a field, or leave it open." is a nice idea, but I do not know what will happen when I press the arrow.
- **The input looks like it works, but it does nothing with my text.** I typed "stack-sortable permutations" and pressed Start. I got a pre-existing session about pop-stack fertility, and my query appeared only in the URL. An empty submit goes to the same page. A real user would feel tricked here.
- **I cannot find the price or the sign-up.** The page has no price, no example and no proof. Docs is a dead link. "Sign in" goes straight into a signed-in account.
- The footer line "lumen (lm), the SI unit of luminous flux" is a pleasant touch.
- At 390 px and 900 px the layout holds. At 900 px a large empty area sits above the headline, and the page looks unbalanced.

## Home page: clear, with small problems

- This page is the clearest of the three. I understand it at once: a new-research box, a list of projects, a status for each project, a cost, and a budget of "$0.71 of $200". The summary lines are good. They state results, not activity.
- "Waiting on you" is in red, which is correct. But the summary does not say what the project waits for.
- **All three projects open the same session.** The budget figure "$0.71 of $200" also links to that session. I expected the budget to open a billing page.
- **The home page and the session disagree about the same project.** Home shows Pop-stack fertility as "Running · $0.41 · 41 min ago". The session shows it as "Finished · $0.94 · 2 h 14 min". Also, $0.94 for one project is more than the $0.71 total shown as spent. A careful user notices numbers like these, and the product's pitch is careful numbers.
- On mobile the summaries are cut off with an ellipsis, and that is acceptable.

## Session page: the strongest page

- The left column has the labels You, Thinking, Search, Delegated, Run, Reply and Record. This layout makes the agent's process readable. The "Thinking" lines sound like a researcher talking: "A result I rediscover is worth nothing." The agent drops leads that are already solved. That builds trust better than any marketing text could.
- The right rail is useful: a call tree, findings with Confirmed, Open and Dropped status, and a file list. On mobile the rail becomes a "Details" sheet, and that works.
- The page opens scrolled to the bottom, and the steps fade in again on each load. For about a second the log is blank, and in dark mode it was fully blank at 0.5 s. That looks like a broken page before it looks like an animation.
- **Send does nothing.** I typed "try it" and pressed Send. The text stayed in the box and nothing new appeared. The "+" attach button also does nothing visible.
- The scroll position of the log does not follow the call tree. Hovering over an agent name in the call tree gives no link to the steps that agent took.

## Content: a mathematician would object to the showcase numbers

The demo content is all the product has to persuade the reader, so I checked it. I am not fully certain of the following points, so verify them before anyone outside the team sees the pages:

- The run output labels `1,2,6,22,91,408,1938` as A000260. Those numbers are the 2-stack-sortable counts, 2(3n)!/((n+1)!(2n+1)!), which is A000139. So the headline finding, "the commonly cited 3-stack-sortable sequence is wrong", compares against the wrong sequence. An expert in the field would see this at once.
- The page gives the 3-stack-sortable terms as 21426 and 137901. I remember the published values as 21434 and 138100.

If these points are right, the showcase finding is the very kind of error the product says it catches. That would hurt more than any problem in the design.

## Overall

The pages are well designed, and the session page sells the idea. The landing page does not explain the product. Every input except the tabs is fake: Start ignores the query, Send does nothing, and "+" does nothing. The numbers do not agree between pages, and the showcase mathematics may be wrong. Fix the numbers first, because exact results are the whole pitch.
