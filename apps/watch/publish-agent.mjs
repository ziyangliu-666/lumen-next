#!/usr/bin/env node
// The producer side: publish the agent "literature-scout" in the platform's
// registry, so that the watch (the consumer side) can ask with it.
//
//   LUMEN_URL=https://lumen.example LUMEN_API_KEY=lmn_... node publish-agent.mjs
//
// The key needs agents:write (and agents:read for the "already there" check).
// Exit codes: 0 published or already there; 1 refused; 2 configuration or key.

import { FatalError, api, readConfig } from './watch.mjs';

export const AGENT = {
  slug: 'literature-scout',
  name: 'Literature Scout',
  description: 'Finds recent papers on a topic in arXiv and OpenAlex, one line each.',
  instructions: [
    'You watch the research literature for one topic.',
    'Search arXiv and OpenAlex. Prefer work from the last 12 months.',
    'For each paper, give the title, the year, a one-line contribution and a link.',
    'Do not invent papers, authors or links. Give only what a search returned.',
    'At the end, say clearly what you could not check, and why.',
  ].join('\n'),
};

export async function publish(env = process.env) {
  try {
    const config = readConfig(env);
    const created = await api(config, 'POST', '/api/v1/agents', AGENT);
    if (created.status === 201 || created.status === 200) {
      console.log(`Published the agent ${AGENT.slug}.`);
      return 0;
    }
    // The contract does not fix the status for a taken slug (409 is likely),
    // so ask the registry before calling it a failure.
    const existing = await api(config, 'GET', `/api/v1/agents/${AGENT.slug}`).catch(() => null);
    if (created.status === 409 || existing?.status === 200) {
      console.log(`The agent ${AGENT.slug} exists already. Nothing to do.`);
      return 0;
    }
    console.error(`POST /api/v1/agents: ${created.status} ${created.body?.error ?? ''}`);
    return 1;
  } catch (error) {
    console.error(error.message);
    return error instanceof FatalError ? 2 : 1;
  }
}

const code = await publish();
// fetch keeps idle sockets open for seconds; exit now, once stdout is flushed.
process.stdout.write('', () => process.exit(code));
