// POST /api/v1/questions, in the project service (docs/platform/public-api.md,
// "How a chosen agent reaches the worker").
//
// The root turn can reach a worker before POST /api/projects returns, so the
// choice of agent is written first, as an intent row with no session. Then the
// project is created with the same request the web app sends, through inject
// with the caller's own credentials, so the projects slice does not change
// and the project belongs to the caller. Last, the intent gets its session id.
import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest } from '../../core/http/httpError.js';
import { INTERNAL_HEADER } from '../shared/internal.js';
import type { AgentStore, IntentStore } from './registry.js';

/** The projects slice's own limit on a question. */
const MAX_QUESTION = 10000;

export function questionRequestOf(body: unknown): { question: string; agent: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('body must be an object');
  }
  const { question, agent, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) throw badRequest('unexpected field');
  // Trimmed as the projects slice trims it: the worker matches an intent to a
  // session by this exact text.
  const text = typeof question === 'string' ? question.trim() : '';
  if (!text || [...text].length > MAX_QUESTION) {
    throw badRequest(`question must be 1 to ${MAX_QUESTION} characters`);
  }
  if (agent !== undefined && agent !== null && typeof agent !== 'string') {
    throw badRequest('agent must be a slug');
  }
  return { question: text, agent: typeof agent === 'string' ? agent : null };
}

export interface AskRouteDeps {
  readonly agents: AgentStore;
  readonly intents: IntentStore;
  /** The shared internal key: it lets the caller's key reach /api/projects in the inject. */
  readonly internalKey: string;
}

interface Created {
  readonly project?: { readonly id?: string };
  readonly sessionId?: string;
}

export function registerAskRoutes(app: FastifyInstance, deps: AskRouteDeps): void {
  app.post('/api/v1/questions', async (request, reply) => {
    const principal = requireUser(request);
    const { question, agent: slug } = questionRequestOf(request.body);
    const agent = slug === null ? null : await deps.agents.bySlug(slug);
    if (slug !== null && (!agent || agent.withdrawnAt !== null)) {
      throw badRequest(`"${slug}" is not a published agent`);
    }

    const intentId = await deps.intents.insert(principal.accountId, agent?.id ?? null, question);
    const { authorization, cookie } = request.headers;
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        'content-type': 'application/json',
        [INTERNAL_HEADER]: deps.internalKey,
        ...(authorization === undefined ? {} : { authorization }),
        ...(cookie === undefined ? {} : { cookie }),
      },
      payload: { question, mode: 'explore' },
    });
    let body: Created & { error?: string } = {};
    try {
      body = created.json<Created & { error?: string }>();
    } catch {
      // Not JSON: treated below as a project that was not created.
    }
    if (created.statusCode !== 201 || !body.sessionId || !body.project?.id) {
      await deps.intents.discard(intentId);
      return reply
        .status(created.statusCode === 201 ? 500 : created.statusCode)
        .send({ error: body.error ?? 'the project was not created' });
    }
    await deps.intents.attach(intentId, body.sessionId);
    request.log.info(
      { sessionId: body.sessionId, projectId: body.project.id, agent: agent?.slug ?? null },
      'question asked through the API',
    );
    return reply.status(201).send({
      sessionId: body.sessionId,
      projectId: body.project.id,
      agent: agent?.slug ?? null,
    });
  });
}
