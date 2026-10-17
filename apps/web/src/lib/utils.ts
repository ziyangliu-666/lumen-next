import type { CnFunction } from 'cn';
import { createCn } from 'cn/config';

// Class merging for the whole web app. Import `cn` from here, never from the
// `cn` package directly. This path is the one components.json names, so a
// component that `npx shadcn add` brings in already uses it.
//
// The merge must know our own font sizes. Out of the box it reads
// `text-caption` and `text-display` as colours, because it does not read
// theme.css. Then `cn('text-caption', 'text-ink-2')` keeps only the colour,
// and the 13px hint line under a field silently renders at 16px.
export const cn: CnFunction = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['caption', 'display'] }] } },
});
