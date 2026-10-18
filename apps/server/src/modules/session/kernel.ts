import { randomUUID } from 'node:crypto';
import type {
  Finding,
  Money,
  SessionMode,
  SessionSnapshot,
  SessionSummary,
  StepDetail,
  StepKind,
  Task,
  TaskStatus,
} from '@lumen/contracts';
import { zero } from '@lumen/contracts';
import { allowEverything, type BudgetGuard, type CheckPoint } from '../../core/domain/budget.js';
import { recordable } from '../../core/domain/money.js';
import type { PendingApproval } from '../../core/domain/task.js';
import {
  WaitingForApproval,
  type Delegated,
  type Worker,
  type WorkerReport,
} from '../../core/domain/worker.js';
import type { Principal, SessionAccess } from '../../core/http/authGuard.js';
import { badRequest, notFound } from '../../core/http/httpError.js';
import { nullLog, taskLog, type Log } from '../../core/log/log.js';
import type { Broker } from '../../core/protocol/broker.js';
import { Delegation, DelegationRefused } from './delegation.js';
import { checkedDetail, storable } from './stepDetail.js';
import { buildTree } from './taskComposite.js';
import { isEnding, type Trace } from './trace.js';

// The engine of a session. It opens the root task, hands it to the worker, and
// is the WorkerReport the worker writes through: every report lands in the
// trace and on the socket in one call, so the durable record and the live
// stream cannot disagree.
//
// A worker may delegate: the kernel opens the child tasks, runs them within
// the Delegation bounds, and hands them back when they have come to rest. Cost
// and stop go through the Composite (taskComposite.ts), so nothing here walks
// parent_id. The BudgetGuard check points from ARCHITECTURE.md §9 arrive with
// billing and slot in at start(), say() and delegate().
/** Saves a finding and returns it as saved. The projects slice supplies the real one. */
export type FindingSaver = (sessionId: string, taskId: string, text: string) => Promise<Finding>;

export interface KernelOptions {
  readonly delegation?: Delegation;
  /**
   * The models a session may be opened with, the server's default first. A
   * session that names one off this list is refused. Left out, a session
   * cannot choose and runs on the default.
   */
  readonly models?: readonly string[];
  /**
   * Where findings are kept. Findings belong to the projects slice, so main.ts
   * passes `projects.recordFinding`. Left out, they are kept in this process's
   * memory: enough for a test or a process with no projects slice, and no more.
   */
  readonly saveFinding?: FindingSaver;
  /**
   * Asked before a turn, before a fan-out and before a delegated task opens.
   * The billing slice supplies the real one. Left out, everything is allowed,
   * which is right for a test and for a process with no billing slice.
   */
  readonly budget?: BudgetGuard;
  /** The slice's logger. Each task run writes through a child of it. */
  readonly log?: Log;
}

function findingsInMemory(): FindingSaver {
  const kept: Finding[] = [];
  return (sessionId, taskId, text) => {
    const finding = { id: randomUUID(), sessionId, taskId, text, createdAt: Date.now() };
    kept.push(finding);
    return Promise.resolve(finding);
  };
}

/**
 * How the parent's turn after an approved fan-out begins. A worker that
 * fans out on every turn (the demo) reads it as "answer from the reports".
 */
export const APPROVED_WORK_DONE =
  'The work you delegated was blocked by the spending cap, then approved, and has finished. Here is what each task reported. Use it to answer.';

export class Kernel {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly trace: Trace,
    private readonly broker: Broker,
    private readonly worker: Worker,
    options: KernelOptions = {},
  ) {
    this.delegation = options.delegation ?? new Delegation();
    this.saveFinding = options.saveFinding ?? findingsInMemory();
    this.budget = options.budget ?? allowEverything;
    this.log = options.log ?? nullLog;
    this.models = options.models ?? [];
  }

  private readonly models: readonly string[];

  /** The models a session may choose, the default first. Empty: no choice. */
  allowedModels(): readonly string[] {
    return this.models;
  }

  private readonly delegation: Delegation;
  private readonly saveFinding: FindingSaver;
  private readonly budget: BudgetGuard;
  private readonly log: Log;

  /** Open a session under a project and start its root task. Does not wait for the worker. */
  async start(
    projectId: string,
    accountId: string,
    text: string,
    mode: SessionMode = 'explore',
    model?: string,
  ): Promise<SessionSnapshot> {
    if (model !== undefined && !this.models.includes(model)) {
      throw badRequest(`model must be one of: ${this.models.join(', ') || 'none on this server'}`);
    }
    const session = await this.trace.openSession(projectId, accountId, mode, model);
    const root = await this.trace.openTask(session.id, null, 'lead', text);
    this.broker.publish(session.id, { type: 'task.opened', task: root });
    // Read the snapshot before the worker starts, so the caller always gets
    // the root as it was opened and the page draws the rest from the events.
    const snapshot = await this.snapshotOf(session.id);
    this.track(this.run(root, text, {}));
    return snapshot;
  }

  /**
   * A new turn on the root: the user's words become a step, then the worker
   * runs again. A worker starts each turn from what it is given, so the turn
   * is given the conversation so far: the question that opened the session,
   * then each later message and each answer, in order. Without it a
   * follow-up such as "compute it yourself" reached a lead that no longer
   * knew what "it" was, and it went off on a task of its own.
   */
  async say(
    sessionId: string,
    principal: Principal,
    text: string,
    options: { readonly model?: string; readonly edit?: boolean } = {},
  ): Promise<void> {
    const root = await this.rootFor(sessionId, principal);
    if (options.model !== undefined) {
      if (!this.models.includes(options.model)) {
        throw badRequest(
          `model must be one of: ${this.models.join(', ') || 'none on this server'}`,
        );
      }
      // From this turn on: the worker reads the session's model at each run.
      await this.trace.setModel(sessionId, options.model);
    }
    if (options.edit) {
      // An edit replaces the latest exchange; while it is still being
      // answered there is no settled message to replace.
      if (root.status === 'running') throw badRequest('wait for the turn to end before editing');
      const latest = [...((await this.trace.snapshot(sessionId))?.steps ?? [])]
        .reverse()
        .find((step) => step.taskId === root.id && step.kind === 'you');
      await this.appendStep(root.id, 'you', text, { replaces: latest?.index ?? -1 });
    } else {
      await this.appendStep(root.id, 'you', text);
    }
    // The conversation as it now stands, edits applied, without the words
    // just said: they are the turn's own message.
    const earlier = (await this.conversation(sessionId, root)).slice(0, -1);
    this.track(this.run(root, withConversation(earlier, text), {}));
  }

  /** The root's own exchange so far: the opening question, then 'you' and 'reply' steps. */
  /** The parent's turn after an approved fan-out: what each child reported. */
  private async continuation(parent: Task, children: readonly Task[]): Promise<string> {
    const snapshot = await this.trace.snapshot(parent.sessionId);
    const reports = children.map((child) => {
      const now = snapshot?.tasks.find((task) => task.id === child.id);
      const said = [...(snapshot?.steps ?? [])]
        .reverse()
        .find((step) => step.taskId === child.id && step.kind === 'reply');
      return `## ${child.title}\nstatus: ${now?.status ?? child.status}\n${said?.text ?? '(no answer)'}`;
    });
    const text = [APPROVED_WORK_DONE, '', ...reports].join('\n');
    if (parent.parentId !== null) return text;
    return withConversation(await this.conversation(parent.sessionId, parent), text);
  }

  /**
   * An edited message replaces the one it names and everything after it:
   * the model is given the conversation the person now sees, not the one
   * they rewrote. `at` is the 'you' step's index, -1 for the opening question.
   */
  private async conversation(sessionId: string, root: Task): Promise<Exchange[]> {
    const snapshot = await this.trace.snapshot(sessionId);
    const lines: (Exchange & { readonly at?: number })[] = [
      { who: 'user', text: root.title, at: -1 },
    ];
    for (const step of snapshot?.steps ?? []) {
      if (step.taskId !== root.id) continue;
      if (step.kind === 'you') {
        const replaced = step.detail?.replaces;
        if (replaced !== undefined) {
          const cut = lines.findIndex((line) => line.who === 'user' && line.at === replaced);
          if (cut >= 0) lines.splice(cut);
        }
        lines.push({ who: 'user', text: step.text, at: step.index });
      } else if (step.kind === 'reply') lines.push({ who: 'lumen', text: step.text });
    }
    return lines.map(({ who, text }) => ({ who, text }));
  }

  async stop(sessionId: string, principal: Principal): Promise<void> {
    await this.rootFor(sessionId, principal);
    const snapshot = await this.trace.snapshot(sessionId);
    const tree = snapshot && buildTree(snapshot.tasks);
    if (!snapshot || !tree) return;
    // One call on the root cancels the whole tree. The kernel does not know,
    // and does not ask, how deep it goes.
    tree.cancel();
    const cancelled = new Set(
      tree
        .flatten()
        .filter((node) => node.isCancelled())
        .map((node) => node.id),
    );
    for (const task of snapshot.tasks) {
      // A task that already ended keeps its verdict: stop ends what is going
      // on, it does not rewrite what happened.
      if (cancelled.has(task.id) && !isEnding(task.status)) {
        await this.setStatus(task.id, 'stopped');
      }
    }
  }

  /**
   * A project's sessions that this principal opened, newest first, each with
   * its opening question. The caller has checked the project (the route's
   * gate); a session another account opened under it is still left out.
   */
  async sessionsOf(
    projectId: string,
    principal: Principal,
  ): Promise<(SessionSummary & { readonly title: string })[]> {
    const listed: (SessionSummary & { readonly title: string })[] = [];
    for (const summary of await this.trace.summaries(projectId)) {
      if (!(await this.mayRead(principal, summary.id))) continue;
      const root = await this.trace.rootOf(summary.id);
      // The root's own state: a session whose lead waits on an approval
      // read "Running" in the list.
      listed.push({ ...summary, status: root?.status ?? summary.status, title: root?.title ?? '' });
    }
    return listed;
  }

  async snapshot(sessionId: string, principal: Principal): Promise<SessionSnapshot> {
    await this.rootFor(sessionId, principal);
    return this.snapshotOf(sessionId);
  }

  /**
   * The answer to session.open. The bridge has already checked the principal
   * and subscribed the socket; this publishes the snapshot to the session.
   * Every socket watching it receives it and replaces its state with the same
   * record, which costs a frame and keeps this layer ignorant of sockets.
   */
  async open(sessionId: string, principal: Principal): Promise<void> {
    const snapshot = await this.snapshot(sessionId, principal);
    this.broker.publish(sessionId, { type: 'session.snapshot', snapshot });
  }

  /**
   * Run once at startup, before the server listens. A task that is still
   * queued, running or waiting belongs to a process that is gone, so it cannot
   * be any of those. Nobody pressed stop, but the task was ended from outside:
   * stopped, not failed. Nothing is published, because nobody is connected yet;
   * the next snapshot a browser reads shows it.
   */
  async restore(): Promise<number> {
    // A waiting task waits for a person, not for a process: it keeps waiting,
    // with the operation it was blocked on in its record.
    const orphans = (await this.trace.openTasks()).filter((task) => task.status !== 'waiting');
    for (const task of orphans) await this.trace.setStatus(task.id, 'stopped');
    return orphans.length;
  }

  /**
   * BudgetApprovalResume: billing calls this once the owner granted the
   * approval. The blocked operation is asked again with its own attempt id,
   * and runs if the guard now allows it. Not found for an approval that is not
   * this account's or that names nothing, which a consumed one does; nothing
   * for a task that was stopped while it waited.
   */
  async requestResume(input: {
    readonly accountId: string;
    readonly approvalId: string;
  }): Promise<void> {
    const task = await this.trace.taskByApproval(input.approvalId);
    const session = task ? await this.trace.session(task.sessionId) : null;
    if (!task || !session || session.accountId !== input.accountId) throw notFound('approval');
    if (task.status !== 'waiting' || !task.pending) return;
    const { pending } = task;
    if (pending.at === 'fan-out') this.track(this.resumeFanOut(task, pending));
    else this.track(this.run(task, pending.input, { attemptId: pending.attemptId, resume: true }));
  }

  /**
   * The answer to "who may watch this session?" that core requires before it
   * opens a socket: the account that started it, or staff. An unknown session
   * and somebody else's session answer the same, so the socket route stays a
   * 404 either way and the id is not an oracle.
   */
  readonly access: SessionAccess = {
    canWatch: (principal, sessionId) => this.mayRead(principal, sessionId),
  };

  /**
   * The WorkerReport for one task run: the kernel's methods, and a log whose
   * lines carry this task's ids. The kernel is one object for every task, so
   * the log cannot live on it.
   */
  private reportFor(task: Task, accountId: string | undefined): WorkerReport {
    return {
      log: taskLog(this.log, {
        sessionId: task.sessionId,
        taskId: task.id,
        ...(accountId ? { accountId } : {}),
      }),
      appendStep: (taskId, kind, text, detail) => this.appendStep(taskId, kind, text, detail),
      delegate: (taskId, work) => this.delegate(taskId, work),
      recordFinding: (taskId, text) => this.recordFinding(taskId, text),
      addSpend: (taskId, amount, reason) => this.addSpend(taskId, amount, reason),
      stopped: async (taskId) => (await this.trace.task(taskId))?.status === 'stopped',
      draft: (taskId, text) => {
        this.broker.publish(task.sessionId, { type: 'step.draft', taskId, text: storable(text) });
      },
    };
  }

  // WorkerReport: the one door out of the worker.
  async appendStep(
    taskId: string,
    kind: StepKind,
    text: string,
    detail?: StepDetail,
  ): Promise<void> {
    // The delegate step is the kernel's to write, from the tasks it opened. A
    // worker that wrote one too would draw a second, empty DELEGATED block, and
    // one that named tasks could name tasks that do not exist.
    if (kind === 'delegate' || detail?.childTaskIds) {
      throw new Error('kernel: a delegate step is written by delegate(), not by appendStep()');
    }
    // Everything is checked before anything is written, so a bad amount or a
    // wrong shape leaves neither a step nor a charge.
    const checked = detail ? checkedDetail(detail) : undefined;
    const cost = checked?.cost ? recordable(checked.cost) : undefined;
    const kept = checked && cost ? { ...checked, cost } : checked;
    if (!kept || !cost || cost.dollars === 0) {
      await this.writeStep(taskId, kind, text, kept);
      return;
    }
    // The step is the receipt and this is the charge: one write, then the
    // events. Nothing is announced that the record does not hold.
    const charge = { amount: cost, reason: kept.tool ?? kind };
    const { step, task } = await this.trace.appendCostedStep(
      taskId,
      kind,
      storable(text),
      kept,
      charge,
    );
    this.broker.publish(task.sessionId, { type: 'step.appended', ...step });
    await this.announceCost(task);
  }

  private async writeStep(
    taskId: string,
    kind: StepKind,
    text: string,
    detail?: StepDetail,
  ): Promise<void> {
    const task = await this.taskOrThrow(taskId);
    const step = await this.trace.appendStep(taskId, kind, storable(text), detail);
    this.broker.publish(task.sessionId, { type: 'step.appended', ...step });
  }

  async delegate(taskId: string, work: readonly Delegated[]): Promise<Task[]> {
    const parent = await this.taskOrThrow(taskId);
    this.delegation.check(parent, work);
    // Check point: fan-out. One question for the whole fan-out, before a single
    // child exists, so a refusal leaves nothing half-opened on the page. The
    // children carry the fan-out's attempt id: one approval covers all of them.
    const attemptId = randomUUID();
    const verdict = await this.ask(parent, 'fan-out', fanOutReason(work), attemptId, work);
    if (verdict !== null) {
      this.log.warn(
        { sessionId: parent.sessionId, taskId: parent.id, verdict: verdict.sentence },
        verdict.waiting ? 'fan-out waits for an approval' : 'fan-out refused',
      );
      if (verdict.waiting) throw new WaitingForApproval(verdict.sentence);
      throw new DelegationRefused(`the budget does not allow it: ${verdict.sentence}`);
    }
    const children = await this.openChildren(parent, work);
    await this.delegation.runBounded(children, (child) =>
      this.run(child, child.title, { onlyIfQueued: true, attemptId }),
    );
    return this.rested(children);
  }

  /**
   * Open every child before any of them runs, so the page draws the whole
   * fan-out at once and a stop that arrives now reaches all of them.
   */
  private async openChildren(parent: Task, work: readonly Delegated[]): Promise<Task[]> {
    const children: Task[] = [];
    try {
      for (const item of work) {
        const child = await this.trace.openTask(
          parent.sessionId,
          parent.id,
          item.agent,
          item.title,
        );
        this.broker.publish(parent.sessionId, { type: 'task.opened', task: child });
        children.push(child);
      }
      // The delegate step is written here, after the children exist, so that it
      // can name them, and before any of them runs, so that the page draws the
      // block first and watches the statuses in it change.
      await this.writeStep(parent.id, 'delegate', `delegated ${children.length} in parallel`, {
        childTaskIds: children.map((child) => child.id),
      });
    } catch (error) {
      // Some children exist and nothing will ever run them: the record failed
      // part way through the fan-out, or on the step. Left queued they would
      // sit in the tree for the life of the process; end them, then say.
      for (const child of children) {
        await this.setStatus(child.id, 'stopped').catch(() => undefined);
      }
      throw error;
    }
    return children;
  }

  private async rested(children: readonly Task[]): Promise<Task[]> {
    const rested = await Promise.all(children.map((child) => this.trace.task(child.id)));
    return rested.filter((task): task is NonNullable<typeof task> => task !== null);
  }

  /**
   * A fan-out the guard escalated, after the approval: the parent's turn is
   * over, so the kernel does what delegate() would have done, runs the
   * children, and ends the parent when they have come to rest.
   */
  private async resumeFanOut(parent: Task, pending: PendingApproval): Promise<void> {
    const work = pending.work ?? [];
    const log = taskLog(this.log, { sessionId: parent.sessionId, taskId: parent.id });
    try {
      const verdict = await this.ask(
        parent,
        'fan-out',
        fanOutReason(work),
        pending.attemptId,
        work,
      );
      if (verdict?.waiting) return;
      if (verdict) {
        await this.trace.setPending(parent.id, null);
        await this.appendStep(parent.id, 'reply', `Not run: ${verdict.sentence}.`);
        await this.setStatus(parent.id, 'stopped');
        return;
      }
      await this.trace.setPending(parent.id, null);
      await this.setStatus(parent.id, 'running');
      log.info({ children: work.length }, 'fan-out resumed');
      const children = await this.openChildren(parent, work);
      await this.delegation.runBounded(children, (child) =>
        this.run(child, child.title, { onlyIfQueued: true, attemptId: pending.attemptId }),
      );
      // The parent's turn ended at the block, so nothing would read what the
      // readers found: the session showed Finished with no answer. It is
      // given one more turn with their reports.
      if ((await this.trace.task(parent.id))?.status === 'running') {
        await this.run(parent, await this.continuation(parent, children), { approved: true });
      }
    } catch (error) {
      log.error({ err: error }, 'fan-out resume failed');
      await this.setStatus(parent.id, 'failed').catch(() => undefined);
    }
  }

  async recordFinding(taskId: string, text: string): Promise<Finding> {
    const task = await this.taskOrThrow(taskId);
    if (text.trim().length === 0) throw new Error('kernel: a finding needs text');
    // Save first, announce second. A page must never show a finding that a
    // reload would not bring back.
    const finding = await this.saveFinding(task.sessionId, taskId, text);
    this.broker.publish(task.sessionId, {
      type: 'finding.recorded',
      taskId,
      findingId: finding.id,
      text: finding.text,
    });
    return finding;
  }

  async addSpend(taskId: string, amount: Money, reason: string): Promise<void> {
    // One rule for an amount, shared with the ledger: six decimals, as the
    // column holds it. Without this a worker's 0.1 + 0.2 passed here and was
    // refused inside the ledger's transaction, and the task failed over a float.
    const spent = recordable(amount);
    // Postgres commits billing's ledger and the task cost together before events.
    const task = await this.trace.addCost(taskId, spent, reason);
    await this.announceCost(task);
  }

  /** Tell the page a task's own cost changed, and the new total of it and of each ancestor. */
  private async announceCost(task: Task): Promise<void> {
    this.broker.publish(task.sessionId, {
      type: 'task.cost',
      taskId: task.id,
      ownCost: task.ownCost,
    });
    // The spend changes the total of this task and of every ancestor, and of
    // nothing else. The Composite gives each total; the page only displays it.
    const snapshot = await this.trace.snapshot(task.sessionId);
    const tree = snapshot && buildTree(snapshot.tasks);
    if (!snapshot || !tree) return;
    const byId = new Map(snapshot.tasks.map((row) => [row.id, row]));
    for (let at = byId.get(task.id); at; at = at.parentId ? byId.get(at.parentId) : undefined) {
      const total = tree.find(at.id)?.cost() ?? zero;
      this.broker.publish(task.sessionId, { type: 'task.total', taskId: at.id, total });
    }
  }

  /** Resolves once every worker run started so far has settled. For tests and shutdown. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  /**
   * One turn of one task. `onlyIfQueued` is for a delegated child, which may
   * have waited for a free lane: if a stop reached it in the meantime it must
   * stay stopped, not be set running again. A root's later turn is the
   * opposite case, an ended task that runs again on purpose.
   */
  private async run(
    task: Task,
    input: string,
    options: {
      /** A delegated child: if a stop reached it while it waited for a lane, it stays stopped. */
      readonly onlyIfQueued?: boolean;
      /** The attempt this run is part of; a fresh one when absent. */
      readonly attemptId?: string;
      /** The operation was blocked and approved: its pending record is cleared once the guard allows it. */
      readonly resume?: boolean;
      /**
       * The rest of an operation the person approved (the parent's turn
       * after an approved fan-out): not asked again, or the same cap would
       * block the answer the approval was for.
       */
      readonly approved?: boolean;
    },
  ): Promise<void> {
    const startedAt = Date.now();
    const session = await this.trace.session(task.sessionId).catch(() => null);
    const report = this.reportFor(task, session?.accountId);
    const { log } = report;
    try {
      if (options.onlyIfQueued && (await this.trace.task(task.id))?.status !== 'queued') return;
      // Check point: a turn of the root, or the opening of a delegated task.
      const at = options.onlyIfQueued ? 'task-open' : 'turn';
      const refused = options.approved
        ? null
        : await this.ask(task, at, input, options.attemptId ?? randomUUID());
      if (refused !== null) {
        log.warn({ agent: task.agent, refused: refused.sentence }, 'task refused by the budget');
        await this.appendStep(task.id, 'reply', `Not run: ${refused.sentence}.`);
        return;
      }
      if (options.resume) await this.trace.setPending(task.id, null);
      await this.setStatus(task.id, 'running');
      log.info({ agent: task.agent, parentId: task.parentId }, 'task started');
      await this.worker.run({ ...task, status: 'running' }, input, report);
      // The user may have stopped it while the worker ran; that verdict stands.
      const now = await this.trace.task(task.id);
      if (now?.status === 'running') await this.setStatus(task.id, 'ended');
      log.info(
        {
          agent: task.agent,
          status: now?.status === 'running' ? 'ended' : now?.status,
          durationMs: Date.now() - startedAt,
        },
        'task ended',
      );
    } catch (error) {
      // A fan-out the guard escalated ends the worker's turn with an error, and
      // the task is waiting for the approval: that is not a failure.
      const status = (await this.trace.task(task.id).catch(() => null))?.status;
      if (status === 'waiting') {
        log.info({ agent: task.agent }, 'task waits for an approval');
        return;
      }
      // Stopped while a model call was in flight: the call came back asking
      // to delegate, the delegation was refused because the task had
      // stopped, and the task was marked failed. The person's stop stands.
      if (status === 'stopped') {
        log.info({ agent: task.agent, err: error }, 'task stopped during its turn');
        return;
      }
      // The record itself may be what failed. A run is never awaited by a
      // caller, so an error that escaped here would be an unhandled rejection.
      log.error(
        { agent: task.agent, err: error, durationMs: Date.now() - startedAt },
        'task failed',
      );
      await this.setStatus(task.id, 'failed').catch(() => undefined);
    }
  }

  /**
   * Ask the budget guard. Null means go ahead. Otherwise the task has been put
   * where the decision says (waiting for an approval, or stopped) and the
   * return value is the sentence to show.
   *
   * The estimate is zero, which asks "may this account spend, and has it room
   * left": a worker cannot say yet what a turn will cost. When it can, the
   * estimate travels in Delegated and lands here.
   */
  private async ask(
    task: Task,
    at: CheckPoint,
    reason: string,
    attemptId: string,
    work?: readonly Delegated[],
  ): Promise<{ readonly waiting: boolean; readonly sentence: string } | null> {
    const session = await this.trace.session(task.sessionId);
    if (!session) throw new Error(`kernel: task ${task.id} has no session`);
    let decision;
    try {
      decision = await this.budget.check({
        accountId: session.accountId,
        taskId: task.id,
        attemptId,
        estimate: zero,
        at,
        reason: budgetReason(reason),
      });
    } catch (error) {
      // A guard that could not answer has not said yes. Its error is logged:
      // the person sees only "could not be checked", and without the cause
      // an over-cap turn and a broken guard looked the same.
      taskLog(this.log, { sessionId: task.sessionId, taskId: task.id }).error(
        { err: error, at },
        'budget check failed',
      );
      decision = { kind: 'deny' as const, reason: 'the budget could not be checked' };
    }
    if (decision.kind === 'allow') return null;
    if (decision.kind === 'escalate') {
      // The operation is kept whole with the task, so that a restart does not
      // lose it and the approval resumes exactly it (requestResume).
      await this.trace.setPending(task.id, {
        attemptId,
        approvalId: decision.approvalId,
        at,
        input: reason,
        ...(work ? { work } : {}),
      });
      await this.setStatus(task.id, 'waiting');
      return { waiting: true, sentence: 'it is over the cap and needs your approval' };
    }
    if (at === 'fan-out') {
      // The parent keeps running; it is the fan-out that does not happen.
      return { waiting: false, sentence: decision.reason };
    }
    await this.setStatus(task.id, 'stopped');
    return { waiting: false, sentence: decision.reason };
  }

  private track(run: Promise<void>): void {
    this.inFlight.add(run);
    void run.finally(() => this.inFlight.delete(run));
  }

  private async setStatus(taskId: string, status: TaskStatus): Promise<void> {
    const task = await this.trace.setStatus(taskId, status);
    this.broker.publish(task.sessionId, { type: 'task.status', taskId, status });
  }

  private async mayRead(principal: Principal, sessionId: string): Promise<boolean> {
    const session = await this.trace.session(sessionId);
    if (!session) return false;
    return session.accountId === principal.accountId || principal.role === 'staff';
  }

  private async rootFor(sessionId: string, principal: Principal): Promise<Task> {
    if (!(await this.mayRead(principal, sessionId))) throw notFound('no such session');
    const root = await this.trace.rootOf(sessionId);
    if (!root) throw notFound('no such session');
    return root;
  }

  private async taskOrThrow(taskId: string): Promise<Task> {
    const task = await this.trace.task(taskId);
    if (!task) throw new Error(`kernel: no task ${taskId}`);
    return task;
  }

  private async snapshotOf(sessionId: string): Promise<SessionSnapshot> {
    const snapshot = await this.trace.snapshot(sessionId);
    if (!snapshot) throw notFound('no such session');
    // The session's spend is the root's cost with every descendant rolled up:
    // one call on the Composite, for a tree that is already loaded.
    const tree = buildTree(snapshot.tasks);
    const totals: Record<string, Money> = {};
    for (const node of tree?.flatten() ?? []) {
      const total = node.cost();
      if (total.dollars > 0) totals[node.id] = total;
    }
    return { ...snapshot, totals, spend: tree?.cost() ?? zero };
  }
}

interface Exchange {
  readonly who: 'user' | 'lumen';
  readonly text: string;
}

/** The most of the earlier conversation a turn is given, newest kept, in characters. */
const CONVERSATION_LIMIT = 24_000;

/**
 * The input for a follow-up turn: the conversation so far, then the new
 * message. When the conversation is long the oldest lines go first, but the
 * opening question always stays, because it says what the session is about.
 */
/**
 * What the person reads in Wallet for a blocked fan-out: how many readers,
 * and on what. "delegate 2" said neither.
 */
function fanOutReason(work: readonly Delegated[]): string {
  const what = work.map((part) => part.title).join('; ');
  return `Open ${work.length} ${work.length === 1 ? 'reader' : 'readers'}: ${what}`;
}

const SAID = '\nThe user now says: ';
const REASON_LIMIT = 300;

/**
 * What the budget and an approval request are told a turn is for: the
 * person's latest words, cut short. The turn's input carries the whole
 * conversation (withConversation), and billing refuses a reason over 2,000
 * characters, so every follow-up turn over the cap failed as "the budget
 * could not be checked" instead of asking for an approval.
 */
export function budgetReason(input: string): string {
  const at = input.lastIndexOf(SAID);
  const said = (at >= 0 ? input.slice(at + SAID.length) : input).replace(/\s+/gu, ' ').trim();
  const chars = [...said];
  return chars.length <= REASON_LIMIT ? said : `${chars.slice(0, REASON_LIMIT - 1).join('')}…`;
}

export function withConversation(earlier: readonly Exchange[], text: string): string {
  const render = (line: Exchange): string =>
    `${line.who === 'user' ? 'User' : 'You'}: ${line.text}`;
  const [first, ...rest] = earlier;
  if (!first) return text;
  const kept: string[] = [];
  let size = render(first).length;
  for (let i = rest.length - 1; i >= 0; i--) {
    const line = render(rest[i]!);
    if (size + line.length > CONVERSATION_LIMIT) break;
    kept.unshift(line);
    size += line.length;
  }
  return [
    'The conversation so far:',
    '',
    render(first),
    ...kept,
    '',
    `${SAID.slice(1)}${text}`,
  ].join('\n');
}
