import type { Principal } from '../../core/http/authGuard.js';
import { notFound } from '../../core/http/httpError.js';
import type { Broker } from '../../core/protocol/broker.js';
import { NoActiveRun, type SteerRegistry } from './steerRegistry.js';

// task.steer arrives on the broker carrying a taskId, not a sessionId.
// wsBridge.ts only checks that a socket may watch the *session* a command
// names; a taskId travels underneath that, unchecked, and its own comment
// says so: "the slice that claims such a command owns that check, and must
// make it against the principal." This is that check.

/** From session's own SessionDirectory: which session a task belongs to. Null when there is none. */
export type TaskSession = (taskId: string) => Promise<string | null>;
/** From session's own SessionDirectory: which project and account a session belongs to. */
export type SessionContext = (
  sessionId: string,
) => Promise<{ readonly projectId: string; readonly accountId: string } | null>;

export function steeringCommands(deps: {
  registry: SteerRegistry;
  taskSession: TaskSession;
  sessionContext: SessionContext;
}): (broker: Broker) => void {
  return (broker) => {
    broker.onCommand('task.steer', async (command, principal: Principal) => {
      const sessionId = await deps.taskSession(command.taskId);
      const context = sessionId ? await deps.sessionContext(sessionId) : null;
      // An unknown task and somebody else's task answer the same way, and for
      // the same reason session's own routes give a session id one answer for
      // "not found" and "not yours": a taskId is not a credential, and the
      // caller gets no way to tell which one it was.
      const owned =
        context && (context.accountId === principal.accountId || principal.role === 'staff');
      if (!owned) throw notFound('no such task');

      try {
        deps.registry.steer(command.taskId, command.text, command.when);
      } catch (error) {
        // Nothing running right now to land it against. There is no
        // steer.queued/landed/cancelled event in the contract yet to tell the
        // browser why nothing happened; wsBridge logs a thrown handler error
        // server-side, which is enough for a case a person should rarely hit
        // from the page (the composer only offers this while a task runs).
        if (!(error instanceof NoActiveRun)) throw error;
      }
    });
  };
}
