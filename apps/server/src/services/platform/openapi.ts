// The OpenAPI 3.1 document for the public API v1, served at
// GET /api/v1/openapi.json with no credential (docs/platform/public-api.md).
// It is written by hand from the contract, as a typed object, so a path that
// the contract adds and this file forgets fails the test beside it.
import type { FastifyInstance } from 'fastify';
import { AUTH_COOKIE } from '../../modules/identity/index.js';
import { SCOPES } from './apiKeys.js';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

interface Operation {
  readonly summary: string;
  readonly tags: readonly string[];
  readonly security?: readonly Record<string, readonly string[]>[];
  readonly parameters?: readonly Json[];
  readonly requestBody?: Json;
  readonly responses: Record<string, Json>;
}

export interface OpenApiDocument {
  readonly openapi: '3.1.0';
  readonly info: { readonly title: string; readonly version: string; readonly description: string };
  readonly servers: readonly { readonly url: string }[];
  readonly paths: Record<string, Partial<Record<'get' | 'post' | 'delete', Operation>>>;
  readonly components: {
    readonly securitySchemes: Record<string, Json>;
    readonly schemas: Record<string, Json>;
  };
}

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Json): Json => ({ content: { 'application/json': { schema } } });
const answer = (description: string, schema?: Json): Json =>
  schema === undefined ? { description } : { description, ...(json(schema) as object) };
const error = (description: string): Json => answer(description, ref('Error'));

/** A key with this scope, or a signed-in browser. */
const keyOrCookie = (scope: string): Record<string, readonly string[]>[] => [
  { apiKey: [scope] },
  { cookie: [] },
];
const cookieOnly: Record<string, readonly string[]>[] = [{ cookie: [] }];

const keyErrors = {
  '401': error('No credential, or an unknown or revoked API key.'),
  '403': error('The API key lacks the scope, or the route is not open to keys.'),
  '429': {
    description: 'Over the API key rate limit: 60 a minute, burst 20, in each pod.',
    headers: { 'Retry-After': { schema: { type: 'integer' } } },
    ...(json(ref('Error')) as object),
  },
} satisfies Record<string, Json>;

const pathParam = (name: string, schema: Json): Json => ({
  name,
  in: 'path',
  required: true,
  schema,
});

export const openApiDocument: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Lumen public API',
    version: '1.0.0',
    description:
      'Ask a research question with a chosen agent, read the answer, publish agents and read usage. ' +
      'Authenticate with "Authorization: Bearer lmn_..." (an API key created at /api/v1/keys).',
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/v1/keys': {
      post: {
        summary: 'Create an API key. The key is in this answer only.',
        tags: ['keys'],
        security: cookieOnly,
        requestBody: { required: true, ...(json(ref('KeyRequest')) as object) },
        responses: {
          '201': answer('The new key.', ref('CreatedKey')),
          '400': error('Invalid name or scopes.'),
          ...keyErrors,
        },
      },
      get: {
        summary: 'List the API keys of the signed-in account.',
        tags: ['keys'],
        security: cookieOnly,
        responses: {
          '200': answer('The keys, newest first.', {
            type: 'object',
            properties: { items: { type: 'array', items: ref('Key') } },
            required: ['items'],
          }),
          ...keyErrors,
        },
      },
    },
    '/api/v1/keys/{id}': {
      delete: {
        summary: 'Revoke an API key.',
        tags: ['keys'],
        security: cookieOnly,
        parameters: [pathParam('id', { type: 'string', format: 'uuid' })],
        responses: {
          '204': answer('Revoked.'),
          '404': error('No such key, or already revoked.'),
          ...keyErrors,
        },
      },
    },
    '/api/v1/agents': {
      get: {
        summary: 'List the published agents.',
        tags: ['agents'],
        security: keyOrCookie('agents:read'),
        responses: {
          '200': answer('Published agents, by slug.', {
            type: 'object',
            properties: { items: { type: 'array', items: ref('Agent') } },
            required: ['items'],
          }),
          ...keyErrors,
        },
      },
      post: {
        summary: 'Publish an agent.',
        tags: ['agents'],
        security: keyOrCookie('agents:write'),
        requestBody: { required: true, ...(json(ref('AgentRequest')) as object) },
        responses: {
          '201': answer('The agent, with its instructions.', ref('Agent')),
          '400': error('Invalid field.'),
          '409': error('The slug is taken.'),
          ...keyErrors,
        },
      },
    },
    '/api/v1/agents/{slug}': {
      get: {
        summary: 'Read one published agent. Only its owner reads its instructions.',
        tags: ['agents'],
        security: keyOrCookie('agents:read'),
        parameters: [pathParam('slug', { type: 'string' })],
        responses: {
          '200': answer('The agent.', ref('Agent')),
          '404': error('No such published agent.'),
          ...keyErrors,
        },
      },
      delete: {
        summary: 'Withdraw an agent. Its usage stays.',
        tags: ['agents'],
        security: keyOrCookie('agents:write'),
        parameters: [pathParam('slug', { type: 'string' })],
        responses: {
          '204': answer('Withdrawn.'),
          '403': error('Not the owner, or the key lacks the scope.'),
          '404': error('No such published agent.'),
          '401': keyErrors['401'],
          '429': keyErrors['429'],
        },
      },
    },
    '/api/v1/questions': {
      post: {
        summary: 'Ask a question, with a published agent or the default lead.',
        tags: ['questions'],
        security: keyOrCookie('questions:write'),
        requestBody: { required: true, ...(json(ref('QuestionRequest')) as object) },
        responses: {
          '201': answer('The question runs.', ref('AskedQuestion')),
          '400': error('Invalid question, or not a published agent.'),
          ...keyErrors,
        },
      },
    },
    '/api/v1/questions/{sessionId}': {
      get: {
        summary: 'Read the answer, the findings and the cost of a question.',
        tags: ['questions'],
        security: keyOrCookie('questions:read'),
        parameters: [pathParam('sessionId', { type: 'string', format: 'uuid' })],
        responses: {
          '200': answer('The question as it stands.', ref('Answer')),
          '404': error('No such session for this account.'),
          ...keyErrors,
        },
      },
    },
    '/api/v1/usage': {
      get: {
        summary: 'Usage as a consumer and as a producer; every agent for staff.',
        tags: ['usage'],
        security: keyOrCookie('usage:read'),
        responses: { '200': answer('Usage.', ref('Usage')), ...keyErrors },
      },
    },
    '/api/v1/openapi.json': {
      get: {
        summary: 'This document.',
        tags: ['meta'],
        security: [],
        responses: { '200': answer('The OpenAPI 3.1 document.', { type: 'object' }) },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        description: `An API key, lmn_<prefix>_<secret>. Scopes: ${SCOPES.join(', ')}.`,
      },
      cookie: { type: 'apiKey', in: 'cookie', name: AUTH_COOKIE },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      Scope: { type: 'string', enum: [...SCOPES] },
      KeyRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          scopes: { type: 'array', items: ref('Scope'), minItems: 1 },
        },
        required: ['name', 'scopes'],
        additionalProperties: false,
      },
      Key: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          prefix: { type: 'string' },
          scopes: { type: 'array', items: ref('Scope') },
          createdAt: { type: 'string', format: 'date-time' },
          lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
          revokedAt: { type: ['string', 'null'], format: 'date-time' },
        },
        required: ['id', 'name', 'prefix', 'scopes', 'createdAt', 'lastUsedAt', 'revokedAt'],
      },
      CreatedKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          prefix: { type: 'string' },
          scopes: { type: 'array', items: ref('Scope') },
          createdAt: { type: 'string', format: 'date-time' },
          key: { type: 'string', pattern: '^lmn_[0-9A-Za-z]{8}_[0-9A-Za-z]{32}$' },
        },
        required: ['id', 'name', 'prefix', 'scopes', 'createdAt', 'key'],
      },
      AgentRequest: {
        type: 'object',
        properties: {
          slug: { type: 'string', pattern: '^[a-z][a-z0-9-]{2,39}$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          instructions: { type: 'string', minLength: 1, maxLength: 4000 },
        },
        required: ['slug', 'name', 'description', 'instructions'],
        additionalProperties: false,
      },
      Agent: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          owner: { type: 'string', description: "The owner's display name." },
          createdAt: { type: 'string', format: 'date-time' },
          instructions: { type: 'string', description: 'Present for the owner only.' },
        },
        required: ['slug', 'name', 'description', 'owner', 'createdAt'],
      },
      QuestionRequest: {
        type: 'object',
        properties: {
          question: { type: 'string', minLength: 1, maxLength: 10000 },
          agent: { type: 'string', description: 'A published slug. Absent: the default lead.' },
        },
        required: ['question'],
        additionalProperties: false,
      },
      AskedQuestion: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          agent: { type: ['string', 'null'] },
        },
        required: ['sessionId', 'projectId', 'agent'],
      },
      Answer: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['queued', 'running', 'waiting', 'ended', 'stopped', 'failed'],
            description: "The root task's status.",
          },
          agent: { type: ['string', 'null'] },
          answer: {
            type: ['string', 'null'],
            description: "The text of the root task's last reply step.",
          },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: ['string', 'null'] },
                text: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
              required: ['id', 'title', 'text', 'createdAt'],
            },
          },
          cost: { type: 'number', description: "The session's total, in US dollars." },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: ['string', 'null'], format: 'date-time' },
        },
        required: [
          'sessionId',
          'status',
          'agent',
          'answer',
          'findings',
          'cost',
          'startedAt',
          'endedAt',
        ],
      },
      UsageTotals: {
        type: 'object',
        properties: {
          sessions: { type: 'integer' },
          cost: { type: 'number' },
          medianSecondsToRest: { type: ['number', 'null'] },
        },
        required: ['sessions', 'cost', 'medianSecondsToRest'],
      },
      AgentUsage: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          owner: { type: 'string', description: 'In `all` only.' },
          sessions: { type: 'integer' },
          cost: { type: 'number' },
          medianSecondsToRest: { type: ['number', 'null'] },
        },
        required: ['slug', 'sessions', 'cost', 'medianSecondsToRest'],
      },
      Usage: {
        type: 'object',
        properties: {
          asConsumer: ref('UsageTotals'),
          asProducer: { type: 'array', items: ref('AgentUsage') },
          all: {
            type: 'array',
            items: ref('AgentUsage'),
            description: 'Every agent. Staff only.',
          },
        },
        required: ['asConsumer', 'asProducer'],
      },
    },
  },
};

export function registerOpenApiRoute(app: FastifyInstance): void {
  app.get('/api/v1/openapi.json', () => openApiDocument);
}
