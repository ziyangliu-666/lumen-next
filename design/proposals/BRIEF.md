# lumen redesign: brief for three directions

## The product

lumen is a zero-config AI research lab. A researcher types a research question.
A lead agent searches the literature, delegates to sub-agents (a reader, compute
workers), runs code in a sandbox, and records findings. The whole run is a live
call tree. The researcher watches, steps in mid-thought, and changes direction.

The audience is a researcher (PhD level) with no agent-infrastructure skill.
The site must look like a serious scientific instrument, not like an AI toy.

## What is wrong now

The staging site (https://lumen-next-staging.fly.dev/#/) is a centred column of
rounded shadcn cards on blue-grey dark, with a small blue eyebrow, a medium
headline and a form in a card. It reads as a template. Nothing in it belongs to
research or to this product.

## The constraint from the client

- Swiss style (International Typographic Style). Grid as structure, flush-left
  ragged-right text, a grotesque typeface, strong scale contrast, very little
  colour, no decoration. It must feel designed, and it must feel professional.
- Keep the page structure of the annotated spec (`docs/spec/index.html`,
  live at https://ziy.bio/lumen-next/). Same screens, same regions, same
  content. The visual language changes; the information architecture does not.
- Reference sites studied: Linear (left-aligned large sans headline, product UI
  is the hero), Mistral and FutureHouse (exposed grid cells in the nav and
  sections), OpenAI (the input field is the hero), Anthropic (type is the hero),
  Cursor (real product screenshot as proof), Periodic Labs (restraint).

## The screens to build (each direction builds all three)

Real content is in `docs/spec/index.html`. Read these sections and use their
text verbatim. Do not invent lorem ipsum, and do not invent new features.

1. `landing.html`, spec section `id="p1"` (around line 1083). Signed out.
   Wordmark `lumen`, Docs, Sign in. Headline in two beats:
   "Now you can do any frontier work." / "Just start." A mode switch
   (Free exploration | A starting point). One field with attach (+) and send
   inside it. The placeholder changes with the mode:
   - Free exploration: "It finds the question worth asking."
   - A starting point: "A field, a paper, a hunch you cannot shake."
   The spec says no pricing, no logo wall, no blog. You may add ONE quiet
   section below the fold that shows a real excerpt of a run (from the session
   content) as proof of what the product does. Nothing else.
2. `home.html`, spec section `id="p3"` (around line 1197). Signed in.
   Header with spend "$0.71 of $200" and avatar "LZ". The new-research field
   on top, then the project list: three projects with state (Running, Waiting
   on you, Running), spend, a one-paragraph summary, and "11 findings · 41 min
   ago"-style meta.
3. `session.html`, spec section `id="p4"` (around line 1263). The most
   important screen. Breadcrumb "Pop-stack fertility / free exploration",
   "$0.94 · 2 h 14 min", finished. Centre column: the conversation transcript
   (You, Thinking, Search results, Delegated 3 in parallel, Save file, Run with
   terminal output, Reply, Record findings, You, Thinking, Run, Reply, Record).
   Composer at the bottom with placeholder
   "try the induction, and tell me if it stalls". Right rail: Call tree
   (lead → reader, compute-perm, compute-dyck, all done), Findings (5, with
   states dropped / confirmed / open), This project (1 session), Files (7).

## The states, which carry the only colour that means something

- decide: needs a person ("Waiting on you").
- gap: failed, missing, over cap.
- keep: finished and kept, confirmed.
- open: a finding not yet settled.
- dropped: a finding discarded as already known.

## Technical rules for the HTML

- One self-contained HTML file per screen, inline `<style>`, no JS framework.
  A few lines of vanilla JS is fine (the mode switch on landing changes the
  placeholder; a "G" key toggles grid overlay if your direction exposes a grid).
- Fonts from Google Fonts or Fontshare CDN links only. No other external assets.
  No images, no stock photos, no icon fonts. Inline SVG for the few icons
  needed (send, attach) is fine.
- Desktop first at 1440 px wide; must not break at 390 px wide.
- Visible keyboard focus. `prefers-reduced-motion` respected.
- All text in English. Use sentence case. No ALL-CAPS tracked eyebrow labels,
  no "→" appended to buttons, no middle-dot meta strings unless the spec's own
  content uses them, no gradient, no drop shadow, no glow, no emoji.
- Put every colour, size and spacing in CSS custom properties at the top of the
  file, so the token system can move into `apps/web/src/styles/theme.css` later.
- The three files of one direction share the same token block (copy it).

## What "done" looks like

Each file opens directly in a browser from disk and looks finished: a client
can be shown it as a proposal. A short `README.md` in the direction folder
states the token system (colours as named hex values, type scale, grid) and the
one idea that makes this direction different, in under 200 words.
