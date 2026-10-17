# Working in this repo

Five people and five agents write here at the same time. Everything below exists
to keep that from turning into five codebases.

Read first, in this order:

1. [README.md](README.md): what the product is, who owns what.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SLICES.md](docs/SLICES.md).
3. [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md), [docs/UI.md](docs/UI.md),
   [docs/DOD.md](docs/DOD.md).

## Stay inside your slice

- Server code lives in `apps/server/src/modules/<slice>/`, its page in
  `apps/web/src/pages/<page>/`. Touch those, not another owner's.
- Use another slice only through its public index: `modules/<name>`, never
  `modules/<name>/<file>`. A slice may import `core`; `core` imports no slice.
- Ownership is in [CODEOWNERS](CODEOWNERS).

## The web app has one look

- Build pages from the components in `apps/web/src/ui/` (shadcn/ui, Radix).
  Never hand-roll a control that already exists there.
- Colour, spacing and type come from `apps/web/src/styles/theme.css` through
  Tailwind classes: `bg-surface`, `text-muted-foreground`, `text-keep`. No hex
  value in a page, no `style={{ … }}`, no CSS file per page.
- Do not add a UI dependency, and do not import another page. Both need the
  shell owner's review first.
- The full agreement is one page: [docs/UI.md](docs/UI.md).

## Everything is in English

Code, comments, docstrings, test names, commit messages, docs. Team chat is
Chinese; the repository is not. Write it in English the first time.

## Done means the command is green

```bash
npm run verify   # format, lint, strict typecheck, tests, coverage
```

Small commits, Conventional Commits (`feat(session): …`), one branch per task
named `<slice>/<topic>`.
