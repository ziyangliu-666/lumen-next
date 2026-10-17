import { useEffect, useSyncExternalStore } from 'react';

// Light or dark. The OS setting decides; a stored choice overrides it.
// public/theme-init.js applies the same rule before the first paint, so this
// module only keeps the class in step after that: when the OS setting changes,
// when the person toggles, and when another tab stores a choice.
//
// The class "dark" on <html> is the one switch. The canvas scene (ui/space)
// reads its colours from the CSS variables, so it watches that class and
// redraws.
//
// A toggle by the person (the key D, a menu item) runs through the scene's
// theme wipe when the shell has mounted one: the new paper grows over the
// page from the pointer, and the choice is stored and applied when the page
// is covered. Without a scene (a test, or before the shell mounts) the change
// applies at once. Either way it is the same setTheme call, so what persists
// does not change.

export type Theme = 'light' | 'dark';

const KEY = 'lumen-theme';
export const THEME_EVENT = 'lumen:themechange';

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage can be disabled; the OS setting still applies.
    return null;
  }
}

function osTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function apply(): void {
  const next = stored() ?? osTheme();
  const root = document.documentElement;
  if (root.classList.contains('dark') === (next === 'dark')) return;
  root.classList.toggle('dark', next === 'dark');
  root.dispatchEvent(new Event(THEME_EVENT));
}

/** Store a choice and apply it. `null` forgets the choice and follows the OS. */
export function setTheme(theme: Theme | null): void {
  try {
    if (theme) localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the choice lasts until the page reloads.
    document.documentElement.classList.toggle('dark', (theme ?? osTheme()) === 'dark');
    document.documentElement.dispatchEvent(new Event(THEME_EVENT));
    return;
  }
  apply();
}

type ThemeTransition = (apply: () => void) => void;
let transition: ThemeTransition | null = null;

/**
 * Lets the shell run each toggle through its scene. `apply` must be called
 * exactly once. Returns the function that removes it.
 */
export function setThemeTransition(next: ThemeTransition): () => void {
  transition = next;
  return () => {
    if (transition === next) transition = null;
  };
}

// The theme a wipe in progress will apply, so a second press while the page
// is still covered toggles from that theme and not from the one on screen.
let pending: Theme | null = null;

export function toggleTheme(): void {
  const next: Theme = (pending ?? currentTheme()) === 'dark' ? 'light' : 'dark';
  pending = next;
  const apply = (): void => {
    if (pending === next) pending = null;
    setTheme(next);
  };
  if (transition) transition(apply);
  else apply();
}

function subscribe(onChange: () => void): () => void {
  const root = document.documentElement;
  root.addEventListener(THEME_EVENT, onChange);
  return () => root.removeEventListener(THEME_EVENT, onChange);
}

/** The theme on screen now, re-rendering when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}

/**
 * Keeps the theme in step with the OS and with other tabs, and lets the key D
 * toggle it, as in the prototype. D never fires while the person types.
 * The shell calls this once.
 */
export function useThemeFollower(): void {
  useEffect(() => {
    const os = window.matchMedia('(prefers-color-scheme: dark)');
    const onStorage = (event: StorageEvent): void => {
      if (event.key === KEY) apply();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'd' && event.key !== 'D') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
      )
        return;
      toggleTheme();
    };
    apply();
    os.addEventListener('change', apply);
    window.addEventListener('storage', onStorage);
    document.addEventListener('keydown', onKey);
    return () => {
      os.removeEventListener('change', apply);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
}
