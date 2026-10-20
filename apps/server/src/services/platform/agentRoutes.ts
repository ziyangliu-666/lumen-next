// /api/v1/agents and /api/v1/usage, in the project service
// (docs/platform/public-api.md). A producer publishes an agent and reads how
// much it is used; a consumer lists the agents it may choose. keyGuard has
// checked a key's scope before any handler here runs.
import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest, forbidden, HttpError, notFound } from '../../core/http/httpError.js';
import {
  MAX_INSTRUCTIONS,
  SLUG,
  SlugTaken,
  type Agent,
  type AgentStore,
  type UsageStore,
} from './registry.js';

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

function textField(body: Record<string, unknown>, field: string, max: number): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max) {
    throw badRequest(`${field} must be 1 to ${max} characters`);
  }
  return value.trim();
}

export function agentRequestOf(body: unknown): {
  slug: string;
  name: string;
  description: string;
  instructions: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('body must be an object');
  }
  const fields = body as Record<string, unknown>;
  const known = ['slug', 'name', 'description', 'instructions'];
  if (Object.keys(fields).some((key) => !known.includes(key))) throw badRequest('unexpected field');
  if (typeof fields['slug'] !== 'string' || !SLUG.test(fields['slug'])) {
    throw badRequest('slug must match ^[a-z][a-z0-9-]{2,39}$');
  }
  return {
    slug: fields['slug'],
    name: textField(fields, 'name', MAX_NAME),
    description: textField(fields, 'description', MAX_DESCRIPTION),
    instructions: textField(fields, 'instructions', MAX_INSTRUCTIONS),
  };
}

/** The public view. The instructions are the owner's work, so only the owner reads them. */
function agentView(agent: Agent, withInstructions: boolean): Record<string, unknown> {
  const { slug, name, description, owner, createdAt } = agent;
  return {
    slug,
    name,
    description,
    owner,
    createdAt,
    ...(withInstructions ? { instructions: agent.instructions } : {}),
  };
}

export interface AgentRouteDeps {
  readonly agents: AgentStore;
}

export function registerAgentRoutes(app: FastifyInstance, deps: AgentRouteDeps): void {
  const { agents } = deps;

  app.get('/api/v1/agents', async (request) => {
    requireUser(request);
    return { items: (await agents.listPublished()).map((agent) => agentView(agent, false)) };
  });

  app.get<{ Params: { slug: string } }>('/api/v1/agents/:slug', async (request) => {
    const principal = requireUser(request);
    const agent = await agents.bySlug(request.params.slug);
    if (!agent || agent.withdrawnAt !== null) throw notFound('no such agent');
    return agentView(agent, agent.ownerAccountId === principal.accountId);
  });

  app.post('/api/v1/agents', async (request, reply) => {
    const principal = requireUser(request);
    const input = agentRequestOf(request.body);
    try {
      const agent = await agents.publish({ ...input, ownerAccountId: principal.accountId });
      return await reply
        .status(201)
        .header('Location', `/api/v1/agents/${agent.slug}`)
        .send(agentView(agent, true));
    } catch (error) {
      if (error instanceof SlugTaken) throw new HttpError(409, error.message);
      throw error;
    }
  });

  app.delete<{ Params: { slug: string } }>('/api/v1/agents/:slug', async (request, reply) => {
    const principal = requireUser(request);
    const agent = await agents.bySlug(request.params.slug);
    if (!agent || agent.withdrawnAt !== null) throw notFound('no such agent');
    if (agent.ownerAccountId !== principal.accountId) throw forbidden('not your agent');
    await agents.withdraw(agent.id);
    return reply.status(204).send();
  });
}

export interface UsageRouteDeps {
  readonly usage: UsageStore;
}

export function registerUsageRoutes(app: FastifyInstance, deps: UsageRouteDeps): void {
  app.get('/api/v1/usage', async (request) => {
    const principal = requireUser(request);
    const [asConsumer, mine] = await Promise.all([
      deps.usage.asConsumer(principal.accountId),
      deps.usage.byAgent(principal.accountId),
    ]);
    return {
      asConsumer,
      asProducer: mine.map(({ owner: _owner, ...row }) => row),
      // The operator's view: every agent, with its owner.
      ...(principal.role === 'staff' ? { all: await deps.usage.byAgent() } : {}),
    };
  });
}
