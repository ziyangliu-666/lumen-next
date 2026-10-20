// The worker's half of "How a chosen agent reaches the worker"
// (docs/platform/public-api.md, steps 3 and 4). On a root turn the worker
// claims the session's intent and, when it names an agent, runs the turn with
// the agent's instructions in front of the question.
//
// The agent is an addition to the question, never a condition for it. Any
// failure here (session unreachable, database error) is logged, and the turn
// runs with the input it came with.
import type { Task } from '@lumen/contracts';
import type { Log } from '../../core/log/log.js';
import { agentInput, type IntentAgent } from './registry.js';

export interface RootTurnDeps {
  /** Which account a session belongs to: the remote session directory's context. */
  readonly context: (sessionId: string) => Promise<{ accountId: string } | null>;
  readonly claim: (
    sessionId: string,
    accountId: string,
    question: string,
  ) => Promise<IntentAgent | null>;
  readonly log: Log;
}

/** Returns the input to run the turn with. Only a depth-0 turn is ever changed. */
export function rootTurnInput(deps: RootTurnDeps): (task: Task, input: string) => Promise<string> {
  return async (task, input) => {
    if (task.depth !== 0) return input;
    try {
      const context = await deps.context(task.sessionId);
      if (!context) return input;
      const agent = await deps.claim(task.sessionId, context.accountId, input);
      if (agent) {
        deps.log.info({ sessionId: task.sessionId, agent: agent.slug }, 'root turn runs an agent');
      }
      return agentInput(agent, input);
    } catch (error) {
      deps.log.warn(
        { err: error, sessionId: task.sessionId },
        'agent lookup failed; the turn runs with its own input',
      );
      return input;
    }
  };
}
