import type { Task } from '@lumen/contracts';

// The seam between the kernel (session slice) and the agent (steering slice).
// The kernel runs a task by handing it to a Worker; the Worker reports back
// through WorkerReport and touches nothing else. That is the rule from the
// proposal: the worker never writes the database, so a worker that dies loses
// nothing — the report already landed in the trace.
//
// Sprint 1 carries the smallest shape that lets one step reach the browser.
// Steering adds streamText, delegate, ask and the rest here; the kernel picks
// them up by implementing them, and no worker call site changes.
export interface WorkerReport {
  /** Append one line to the task's trace. Resolves once it is recorded. */
  appendStep(taskId: string, text: string): Promise<void>;
}

export interface Worker {
  /** Run one task to its end. Throwing marks the task failed. */
  run(task: Task, report: WorkerReport): Promise<void>;
}
