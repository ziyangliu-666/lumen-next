import type { JSX, ReactNode } from 'react';
import { cn } from 'cn';

// The frame every page sits in: one header, one content column, one width.
// A page renders what goes inside it and nothing around it. That is what keeps
// six pages written by five people looking like one product.

interface NavItem {
  readonly href: string;
  readonly label: string;
}

const NAV: readonly NavItem[] = [
  { href: '#/home', label: 'Projects' },
  { href: '#/session', label: 'Session' },
  { href: '#/settings', label: 'Settings' },
];

function NavLink({ item, current }: { item: NavItem; current: string }): JSX.Element {
  const active = current === item.href.slice(1) || current.startsWith(`${item.href.slice(1)}/`);
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
      )}
    >
      {item.label}
    </a>
  );
}

export function AppShell({
  path,
  children,
  accountActions,
}: {
  path: string;
  children: ReactNode;
  accountActions?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-rule bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <a href="#/" className="font-mono text-sm font-semibold tracking-tight text-ink">
            lumen
          </a>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} current={path} />
            ))}
          </nav>
          <div className="ml-auto">{accountActions}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

// Title, one line of context, and the actions that belong to the page.
// Every page opens with this, so every page opens the same way.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
