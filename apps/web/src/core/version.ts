import { useEffect, useState } from 'react';

// A tab left open across a deploy keeps running the app it loaded: on
// staging, an open tab still showed the old field and copy after the new
// build was live. The served page names its bundle (assets/index-<hash>.js);
// when that name is not the one this tab runs, a reload brings the new app.
// Checked when the window comes back into focus and every five minutes.

const BUNDLE = /assets\/index-[\w-]+\.js/;
const EVERY_MS = 5 * 60 * 1000;

function running(): string | null {
  for (const script of document.scripts) {
    const name = BUNDLE.exec(script.src)?.[0];
    if (name) return name;
  }
  return null;
}

/** True once the server serves a newer build than this tab runs. */
export function useNewVersion(): boolean {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const mine = running();
    // The dev server has no hashed bundle, and nothing to compare.
    if (!mine) return;
    let active = true;
    const check = (): void => {
      fetch('/', { cache: 'no-store' })
        .then((response) => (response.ok ? response.text() : ''))
        .then((html) => {
          const served = BUNDLE.exec(html)?.[0];
          if (active && served && served !== mine) setFresh(true);
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(check, EVERY_MS);
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);
  return fresh;
}
