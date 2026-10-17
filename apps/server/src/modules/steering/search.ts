import type { StepRow } from '@lumen/contracts';

// The literature connectors: the two places a combinatorics question is
// settled before anything is computed. OEIS answers "is this sequence
// already named", arXiv answers "has someone written this up". The readers'
// sandbox has no network, so without these a reader could only guess an
// A-number from memory, and say so.
//
// Each search returns rows for the page (source, query, what came back, as
// the spec's "Searched" table draws them) and a plain listing for the model.

export const SEARCH_SOURCES = ['oeis', 'arxiv'] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

export interface SearchResult {
  readonly rows: readonly StepRow[];
  /** What the model reads back. */
  readonly text: string;
}

/** Results one search returns; enough to recognise a match, short enough to read. */
const LIMIT = 5;
const TIMEOUT_MS = 10_000;

type Fetch = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export async function search(
  source: SearchSource,
  query: string,
  fetchImpl: Fetch = fetch,
): Promise<SearchResult> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  return source === 'oeis' ? oeis(query, fetchImpl, signal) : arxiv(query, fetchImpl, signal);
}

interface OeisEntry {
  readonly number: number;
  readonly name: string;
  readonly data?: string;
}

async function oeis(query: string, fetchImpl: Fetch, signal: AbortSignal): Promise<SearchResult> {
  const url = `https://oeis.org/search?fmt=json&q=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`OEIS answered HTTP ${response.status}`);
  const body: unknown = JSON.parse((await response.text()) || 'null');
  // The OEIS answers with a bare list now and with { results } before; a
  // query that matches nothing is null or an empty list.
  const list = (
    Array.isArray(body) ? body : ((body as { results?: unknown } | null)?.results ?? [])
  ) as OeisEntry[];
  const hits = (list ?? []).slice(0, LIMIT);
  if (hits.length === 0) {
    return {
      rows: [{ source: 'OEIS', text: query, result: 'No match', empty: true }],
      text: `OEIS: no sequence matches "${query}".`,
    };
  }
  const id = (n: number): string => `A${String(n).padStart(6, '0')}`;
  return {
    rows: hits.map((hit) => ({
      source: 'OEIS',
      text: `${id(hit.number)}, ${hit.name}`,
      result: 'Match',
    })),
    text: [
      `OEIS: ${hits.length} of ${list.length} matches for "${query}".`,
      ...hits.map(
        (hit) =>
          `${id(hit.number)}: ${hit.name}\n  ${(hit.data ?? '').split(',').slice(0, 16).join(',')}`,
      ),
    ].join('\n'),
  };
}

async function arxiv(query: string, fetchImpl: Fetch, signal: AbortSignal): Promise<SearchResult> {
  const url = `https://export.arxiv.org/api/query?max_results=${LIMIT}&search_query=${encodeURIComponent(`all:${query}`)}`;
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`arXiv answered HTTP ${response.status}`);
  const feed = await response.text();
  const entries = [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
    const block = match[1] ?? '';
    const field = (tag: string): string =>
      (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const id = field('id')
      .replace(/^https?:\/\/arxiv\.org\/abs\//, '')
      .replace(/v\d+$/, '');
    return { id, title: field('title'), summary: field('summary').slice(0, 300) };
  });
  if (entries.length === 0) {
    return {
      rows: [{ source: 'arXiv', text: query, result: 'Nothing', empty: true }],
      text: `arXiv: no paper matches "${query}".`,
    };
  }
  return {
    rows: entries.map((entry) => ({
      source: 'arXiv',
      text: `${entry.id}, ${entry.title}`,
      result: 'Paper',
    })),
    text: [
      `arXiv: ${entries.length} papers for "${query}".`,
      ...entries.map((entry) => `${entry.id}: ${entry.title}\n  ${entry.summary}`),
    ].join('\n'),
  };
}
