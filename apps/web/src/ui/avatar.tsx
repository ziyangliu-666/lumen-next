import * as React from 'react';
import { cn } from '@/lib/utils';

// The account in the bar: initials in an outlined circle. It is outlined, not
// filled, so it never competes with the one solid control on a screen, the
// send square. The circle is one of the two round things in Raster; the other
// is the run-state dot.

/** Up to two initials from a display name or an email address. */
function initialsOf(name: string): string {
  const base = name.includes('@') ? (name.split('@')[0] ?? '') : name;
  const words = base
    .split(/[\s._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = [...(words[0] ?? '')][0] ?? '';
  const second = words.length > 1 ? ([...(words[words.length - 1] ?? '')][0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

// Exported so a menu trigger (a <button>) can wear the same circle.
const avatarClassName =
  'inline-grid size-8 shrink-0 place-items-center rounded-full border border-ink text-xs font-semibold text-ink hover:bg-well hover:no-underline';

/**
 * A link when `href` is given, a plain mark otherwise. `label` is what a
 * screen reader hears, for example "Account: Ada Lovelace".
 */
function Avatar({
  name,
  label,
  href,
  className,
  ...props
}: Omit<React.ComponentProps<'a'>, 'children'> & {
  name: string;
  label?: string;
}) {
  const text = initialsOf(name);
  const spoken = label ?? `Account: ${name}`;
  if (href) {
    return (
      <a href={href} aria-label={spoken} className={cn(avatarClassName, className)} {...props}>
        <span aria-hidden="true">{text}</span>
      </a>
    );
  }
  return (
    <span
      role="img"
      aria-label={spoken}
      className={cn(avatarClassName, 'hover:bg-transparent', className)}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

export { Avatar, avatarClassName, initialsOf };
