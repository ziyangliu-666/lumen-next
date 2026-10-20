// The request shapes and the answer shape of the v1 routes, without a database.
import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '@lumen/contracts';
import { HttpError } from '../../core/http/httpError.js';
import { agentRequestOf } from './agentRoutes.js';
import { answerOf } from './answerRoutes.js';
import { questionRequestOf } from './askRoutes.js';
import { ROUTE_SCOPES } from './keyGuard.js';
import { keyRequestOf } from './keyRoutes.js';
import { openApiDocument } from './openapi.js';

function status(work: () => unknown): number | null {
  try {
    work();
    return null;
  } catch (error) {
    return error instanceof HttpError ? error.status : -1;
  }
}

describe('request shapes', () => {
  it('takes a key name and known scopes, without repeats', () => {
    expect(keyRequestOf({ name: ' watch ', scopes: ['agents:read', 'agents:read'] })).toEqual({
      name: 'watch',
      scopes: ['agents:read'],
    });
    expect(status(() => keyRequestOf({ name: 'x', scopes: [] }))).toBe(400);
    expect(status(() => keyRequestOf({ name: 'x', scopes: ['admin'] }))).toBe(400);
    expect(status(() => keyRequestOf({ name: '', scopes: ['usage:read'] }))).toBe(400);
    expect(status(() => keyRequestOf({ name: 'x', scopes: ['usage:read'], extra: 1 }))).toBe(400);
  });

  it('takes an agent with a valid slug and at most 4000 characters of instructions', () => {
    const agent = { slug: 'lit-review', name: 'Review', description: 'd', instructions: 'i' };
    expect(agentRequestOf(agent)).toEqual(agent);
    expect(status(() => agentRequestOf({ ...agent, slug: 'Lit' }))).toBe(400);
    expect(status(() => agentRequestOf({ ...agent, slug: 'ab' }))).toBe(400);
    expect(status(() => agentRequestOf({ ...agent, instructions: 'x'.repeat(4001) }))).toBe(400);
    expect(status(() => agentRequestOf({ ...agent, instructions: 'x'.repeat(4000) }))).toBeNull();
  });

  it('takes a question trimmed, as the projects slice trims it, and an optional agent', () => {
    expect(questionRequestOf({ question: '  why?  ' })).toEqual({ question: 'why?', agent: null });
    expect(questionRequestOf({ question: 'why?', agent: 'lit-review' })).toEqual({
      question: 'why?',
      agent: 'lit-review',
    });
    expect(status(() => questionRequestOf({ question: '   ' }))).toBe(400);
    expect(status(() => questionRequestOf({ question: 'q', agent: 3 }))).toBe(400);
  });
});

describe('answerOf', () => {
  const snapshot: SessionSnapshot = {
    session: { id: 's1', mode: 'explore', projectId: 'p1', accountId: 'a1', startedAt: 0 },
    tasks: [
      {
        id: 'root',
        sessionId: 's1',
        parentId: null,
        agent: 'lead',
        title: 'q',
        depth: 0,
        status: 'ended',
        ownCost: { dollars: 0.1 },
        startedAt: Date.parse('2026-10-20T12:00:00Z'),
        endedAt: Date.parse('2026-10-20T12:01:00Z'),
      },
      {
        id: 'child',
        sessionId: 's1',
        parentId: 'root',
        agent: 'reader',
        title: 'c',
        depth: 1,
        status: 'ended',
        ownCost: { dollars: 0.2 },
        startedAt: 0,
        endedAt: 0,
      },
    ],
    steps: [
      { taskId: 'root', index: 0, kind: 'reply', text: 'first answer' },
      { taskId: 'child', index: 0, kind: 'reply', text: "the child's reply" },
      { taskId: 'root', index: 2, kind: 'reply', text: 'final answer' },
      { taskId: 'root', index: 1, kind: 'thinking', text: 'hmm' },
    ],
    totals: {},
    spend: { dollars: 0.3 },
  };

  it("answers with the root's status, its last reply, the findings and the total cost", () => {
    expect(
      answerOf(
        snapshot,
        [{ id: 'f1', sessionId: 's1', taskId: 'child', text: 'found', createdAt: 0 }],
        'lit-review',
      ),
    ).toEqual({
      sessionId: 's1',
      status: 'ended',
      agent: 'lit-review',
      answer: 'final answer',
      findings: [{ id: 'f1', title: null, text: 'found', createdAt: '1970-01-01T00:00:00.000Z' }],
      cost: 0.3,
      startedAt: '2026-10-20T12:00:00.000Z',
      endedAt: '2026-10-20T12:01:00.000Z',
    });
  });

  it('answers null before the root has replied', () => {
    const early = { ...snapshot, steps: [] };
    expect(answerOf(early, [], null)).toMatchObject({ answer: null, agent: null });
  });
});

describe('the OpenAPI document', () => {
  it('describes every v1 route the guard knows, with the same method', () => {
    for (const route of Object.keys(ROUTE_SCOPES)) {
      const [method, url] = route.split(' ') as [string, string];
      const path = url.replace(/:(\w+)/g, '{$1}');
      expect(openApiDocument.paths[path], route).toBeDefined();
      expect(
        openApiDocument.paths[path]?.[method.toLowerCase() as 'get' | 'post' | 'delete'],
        route,
      ).toBeDefined();
    }
  });

  it("names each route's scope in its security, as the guard checks it", () => {
    for (const [route, scope] of Object.entries(ROUTE_SCOPES)) {
      if (scope === null || scope === 'open') continue;
      const [method, url] = route.split(' ') as [string, string];
      const operation =
        openApiDocument.paths[url.replace(/:(\w+)/g, '{$1}')]?.[
          method.toLowerCase() as 'get' | 'post' | 'delete'
        ];
      expect(operation?.security, route).toContainEqual({ apiKey: [scope] });
    }
  });
});
