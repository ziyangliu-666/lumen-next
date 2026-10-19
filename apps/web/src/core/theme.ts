import { useEffect, useSyncExternalStore } from 'react';

// Light or dark. Everyone starts dark, the look the product is drawn for;
// a stored choice overrides it. The OS setting is not followed: on a light
// OS the first visit opened on a light page the owner did not want first.
// public/theme-init.js applies the same rule before the first paint, so this
// module only keeps the class in step after that: when the person toggles,
// and when another tab stores a choice.
//
// The class "dark" on <html> is the one switch. The canvas scene (ui/space)
// reads its colours from the CSS variables, so it watches that class and
// redraws.
//
// A toggle by the person (the bar's button) runs through the scene's
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
    // Storage can be disabled; the default applies.
    return null;
  }
}

/** What a person who has not chosen sees. */
const DEFAULT_THEME: Theme = 'dark';

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function apply(): void {
  const next = stored() ?? DEFAULT_THEME;
  const root = document.documentElement;
  if (root.classList.contains('dark') === (next === 'dark')) return;
  root.classList.toggle('dark', next === 'dark');
  root.dispatchEvent(new Event(THEME_EVENT));
}

/** Store a choice and apply it. `null` forgets the choice and goes back to the default. */
export function setTheme(theme: Theme | null): void {
  try {
    if (theme) localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the choice lasts until the page reloads.
    document.documentElement.classList.toggle('dark', (theme ?? DEFAULT_THEME) === 'dark');
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
  return useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);
}

/**
 * Keeps the theme in step with other tabs. The shell calls this once. The
 * key D toggled the theme too, as in the prototype; it is gone, because a
 * stray key press changed the page, and the bar has a button for it.
 */
export function useThemeFollower(): void {
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === KEY) apply();
    };
    apply();
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
