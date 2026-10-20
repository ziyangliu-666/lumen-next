import { describe, expect, it } from 'vitest';
import type { Task } from '@lumen/contracts';
import { nullLog } from '../../core/log/log.js';
import { agentInput, type IntentAgent } from './registry.js';
import { rootTurnInput, type RootTurnDeps } from './rootTurn.js';

const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-0000000000aa';

const root: Task = {
  id: 'task-1',
  sessionId: SESSION,
  parentId: null,
  agent: 'lead',
  title: 'root',
  depth: 0,
  status: 'running',
  ownCost: { dollars: 0 },
  startedAt: 0,
  endedAt: null,
};

const reviewer: IntentAgent = {
  slug: 'lit-review',
  name: 'Literature review',
  instructions: 'Search arXiv first.\nCite every source.',
};

describe('agentInput', () => {
  it("puts the agent's instructions in front of the question, exactly as the contract says", () => {
    expect(agentInput(reviewer, 'What is known about X?')).toBe(
      'Instructions from the agent "Literature review" (lit-review):\n' +
        'Search arXiv first.\nCite every source.\n\n' +
        'Question:\nWhat is known about X?',
    );
  });

  it('leaves the input as it is without an agent', () => {
    expect(agentInput(null, 'What is known about X?')).toBe('What is known about X?');
  });
});

describe('rootTurnInput', () => {
  function deps(overrides: Partial<RootTurnDeps> = {}): RootTurnDeps & { claims: string[] } {
    const claims: string[] = [];
    return {
      claims,
      context: () => Promise.resolve({ accountId: ACCOUNT }),
      claim: (sessionId, accountId, question) => {
        claims.push(`${sessionId} ${accountId} ${question}`);
        return Promise.resolve(reviewer);
      },
      log: nullLog,
      ...overrides,
    };
  }

  it('claims the intent of a root turn with its account and question, and rewrites the input', async () => {
    const given = deps();
    const input = await rootTurnInput(given)(root, 'q');
    expect(given.claims).toEqual([`${SESSION} ${ACCOUNT} q`]);
    expect(input).toBe(agentInput(reviewer, 'q'));
  });

  it('never touches a delegated turn', async () => {
    const given = deps();
    expect(await rootTurnInput(given)({ ...root, depth: 1 }, 'child work')).toBe('child work');
    expect(given.claims).toEqual([]);
  });

  it('runs with the original input when no intent names an agent', async () => {
    const input = await rootTurnInput(deps({ claim: () => Promise.resolve(null) }))(root, 'q');
    expect(input).toBe('q');
  });

  it('runs with the original input when the session or the database fails', async () => {
    const down = deps({ context: () => Promise.reject(new Error('session down')) });
    expect(await rootTurnInput(down)(root, 'q')).toBe('q');
    const broken = deps({ claim: () => Promise.reject(new Error('db down')) });
    expect(await rootTurnInput(broken)(root, 'q')).toBe('q');
    const unknown = deps({ context: () => Promise.resolve(null) });
    expect(await rootTurnInput(unknown)(root, 'q')).toBe('q');
  });
});
