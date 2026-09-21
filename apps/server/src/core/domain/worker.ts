import type { Finding, Money, StepDetail, StepKind, Task } from '@lumen/contracts';

// The seam between the kernel (session slice) and the agent (steering slice).
// The kernel runs a task by handing it to a Worker; the Worker reports back
// through WorkerReport and touches nothing else. That is the rule from the
// proposal: the worker never writes the database, so a worker that dies loses
// nothing — the report already landed in the trace.
//
// Steering adds streamText and ask here when it needs them; the
// kernel picks them up by implementing them, and no worker call site changes.

/** One piece of work handed down: which agent does it, and its one-line title. */
export interface Delegated {
  readonly agent: string;
  readonly title: string;
}

export interface WorkerReport {
  /**
   * Append one line to the task's trace. Resolves once it is recorded. `text`
   * alone must say what happened; `detail` is what it carried (the tool, the
   * time, rows or output). A `detail.cost` is also charged to the task, in the
   * same call, so a step's receipt and the task's cost cannot disagree: do not
   * call addSpend for it as well. Never pass `childTaskIds`: delegate() writes
   * the delegate step itself, with the tasks it really opened.
   */
  appendStep(taskId: string, kind: StepKind, text: string, detail?: StepDetail): Promise<void>;
  /**
   * Record a delegate step on `taskId` naming the children, open one child task
   * per entry under it, run them, and resolve when
   * every child has come to rest, with the children as they ended. A child that
   * fails does not reject this: the parent reads its status and decides.
   * Rejects when the tree would become deeper than the kernel allows.
   */
  delegate(taskId: string, work: readonly Delegated[]): Promise<Task[]>;
  /**
   * Keep a result. Resolves with the finding once it is saved, and only then is
   * it announced to the page. Required, not optional: a report that lacked it
   * would let a worker lose a finding without anybody hearing an error.
   */
  recordFinding(taskId: string, text: string): Promise<Finding>;
  /**
   * Add to the task's own cost, for a spend that is not a step's. The roll-up
   * to its ancestors is the kernel's.
   */
  addSpend(taskId: string, amount: Money, reason: string): Promise<void>;
}

export interface Worker {
  /**
   * Run one turn of one task to its end. `input` is what started the turn: the
   * question for the first turn of a root, the task's title for a delegated
   * task, the user's words for a later turn. Throwing marks the task failed.
   */
  run(task: Task, input: string, report: WorkerReport): Promise<void>;
}
