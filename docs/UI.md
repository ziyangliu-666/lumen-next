# The web app: one look, five authors

Five people write pages here, and each of them drives an agent. Left alone,
five agents produce five design systems in one week: one writes inline styles,
one installs a second component library, one invents a fourth shade of grey.
This page is the agreement that stops that. It is short on purpose.

## What is already decided

- **Tailwind CSS 4** for layout and spacing. No CSS file per page, no CSS
  modules, no styled-components.
- **shadcn/ui** (`new-york`, Radix primitives) for controls. The components are
  source files in `apps/web/src/ui/`, not a dependency. They are ours to edit.
- **The palette is "Raster"**, approved as a static prototype in
  `design/proposals/a-raster/` (read `reviews/README.md` there for the
  reasons). It lives in `apps/web/src/styles/theme.css` and nowhere else.
  Swiss: zero radius, a flush-left 12-column grid, black ink on white paper
  (white on black in dark), a grey well for side panels, and one red that
  means "waits on you" and nothing else.
- **Light or dark follows the OS.** Key D toggles it and the choice persists
  (`core/theme.ts`, `public/theme-init.js`).
- **One screen.** The page never scrolls as a whole; a region inside it does
  (`ScrollRegion`). The bar is the shell's; a page fills its slots.

## The five rules

1. **Build from `@/ui`.** If a control exists there, use it. Never hand-roll a
   `<button className="rounded border px-3">`.
2. **Colour comes from the theme.** `bg-surface`, `text-muted-foreground`,
   `text-keep`, `bg-decide-soft`. Never a hex value in a page. ESLint fails the
   build on `text-[#ff0000]` and on `style={{ … }}`.
3. **A page owns its folder only.** A page never imports another page. Anything
   two pages need becomes a component in `@/ui` or a piece of the shell in
   `@/core`, and that is a pull request the shell owner reviews.
4. **Do not add a UI dependency.** No second icon set, no chart library, no
   animation library, without asking the shell owner first. One of each is the
   point.
5. **New shared component: ask, then add.** `apps/web/src/ui/` and
   `apps/web/src/styles/` are owned (see `/CODEOWNERS`). Your own page-local
   component stays in your page folder.

## The vocabulary

Learn these names once and the app stays consistent without anyone policing it.

| Meaning | Class |
|---|---|
| The page and the main content | `bg-paper` |
| The second surface: side panels, a selected row on paper, code | `bg-well` |
| A selected row on the well (paper in light, one step up in dark) | `bg-raised` |
| Text, control borders, marks | `text-ink`, `border-ink` |
| Secondary text, captions | `text-ink-2` |
| Placeholders, the quietest text | `text-ink-3` |
| A rule between regions / between items | `border-rule-major` / `border-rule-minor` |
| Waits on you, and nothing else | `text-signal` (prefer `RunState state="waiting"`) |
| The 13px hint line under a field | `text-caption` |
| The page margin, the column gutter, the bar height | `px-margin`, `gap-gutter`, `h-bar` |

The earlier names (`bg-surface`, `bg-sunken`, `text-muted-foreground`,
`text-faint`, `text-decide`, `text-gap`, `text-keep` and their `-soft`
backgrounds) still compile, mapped onto the palette above. Do not use them in
new code. `gap` and `keep` are ink now: a failure is said in words, not in red.

State is a mark and a word, never a coloured box:

- A run: `RunState` (`@/ui/run-state`). Circles: waiting, running, finished, stopped.
- A finding: `Verdict` (`@/ui/verdict`). Squares: open question, confirmed, dropped.

A message about the page itself (a load failed, a feature is off on this
server) is an `Alert` (`@/ui/alert`): an ink rule on the left, a short title,
one sentence. Never a bare line of body text, and never a raw server string.
Give it an action (Retry) only when the action can succeed.

Copy is sentence case, with no middle-dot meta strings, no em dashes and no
emoji.

Money, IDs, timestamps and code are `font-mono`. Everything else inherits the
sans stack; you never write `font-sans`.

Spacing: stay on the 4px scale Tailwind gives you (`gap-2`, `p-4`, `p-6`).
Space that is not on the scale (the margin, the gutter, the bar) has a name.

Import `cn` from `@/lib/utils`, not from the `cn` package. That one knows our
font sizes; the package alone drops `text-caption` next to a text colour.

## The shape of a page

The bar, the margin and the one screen come from `AppShell`. A page renders
what goes inside it and nothing around it. There are two shapes.

An app page (home, session, admin) is two surfaces, paper and well:

```tsx
// Owner: <YOUR NAME>. Page: <NAME>.
import type { JSX } from 'react';
import { BarCrumb } from '@/core/shell';
import { ScrollRegion } from '@/ui/scroll-region';
import { RegionName, SurfaceMain, Surfaces, SurfaceWell } from '@/ui/surfaces';

export function Projects(): JSX.Element {
  return (
    <Surfaces collapse="stack">
      <BarCrumb>
        <h1 className="text-sm font-semibold text-ink">Projects</h1>
      </BarCrumb>
      <SurfaceMain>
        <RegionName count={3}>Projects</RegionName>
        <ScrollRegion className="flex-1">…</ScrollRegion>
      </SurfaceMain>
      <SurfaceWell aria-label="New project and findings">…</SurfaceWell>
    </Surfaces>
  );
}
```

- `BarCrumb`, `BarStatus` and `BarActions` (`@/core/shell`) put the page's
  breadcrumb, status and actions in the bar. Under 720px the shell gives the
  breadcrumb and the status a line each; a page does not draw its own.
- A signed-in page that is not a session names itself with `PageCrumb`
  (`@/core/shell`): `<PageCrumb />` is "Projects", `<PageCrumb page="Settings" />`
  is "Projects / Settings". Do not add an in-page title as well.
- A row that opens something marks the open one with a 2px ink rule on its
  left (and, on the well, the `bg-raised` fill). Hover is lighter than that,
  never the same: a hovered row must not look open.
- `collapse="stack"` puts the well under the paper below 1080px;
  `collapse="sheet"` makes it a sheet that the page opens from `BarActions`.

A single-column page (settings, sign in) is `PageHeader` and then ruled
`Section`s (`@/ui/section`), not cards.

The closest page to what you are building is the fastest thing to read.

## Adding a component

```bash
cd apps/web
npx shadcn@latest add <name>     # lands in src/ui/, already wearing our theme
```

Ask the owner of `src/ui/` first, in the group chat or on the pull request. Two
people adding `dialog` on two branches is a merge conflict in a vendored file,
which is the least interesting conflict there is.

## What the pipeline checks

`npm run verify` now covers the web app too:

- Prettier, with `prettier-plugin-tailwindcss`, which sorts class names for you.
  Never argue about class order; run `npm run format`.
- ESLint: React hooks rules, `jsx-a11y`, no inline styles, no hex colours, no
  cross-page imports.
- TypeScript in strict mode, over `apps/web` as well.

Vendored `src/ui/**` is exempt from lint. It is generated by the shadcn CLI, and
our house rules would only fight the generator.
