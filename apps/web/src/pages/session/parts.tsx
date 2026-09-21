// The pieces of the Session page. Owner: LIU ZIYANG, except Composer, which is
// LI ZHUOYANG's: it sits where the annotated spec puts it (docs/spec, 04), it
// can say a new turn to the lead, and steering and attachments are his to add.
import type { FormEvent, JSX, ReactNode } from 'react';
import type { Step, Task } from '@lumen/contracts';
import { cn } from 'cn';
import { Plus, SendHorizontal } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import type { SessionFinding } from '@/core/api';
import { childrenByStep, took, toolLabel, treeRows } from './tree';

// One tint per task status, from the theme, so a status means the same colour
// here as on the project card.
const STATUS_TONE: Record<Task['status'], string> = {
  queued: 'text-faint',
  running: 'text-primary',
  waiting: 'text-decide',
  ended: 'text-keep',
  stopped: 'text-gap',
  failed: 'text-gap',
};

const STATUS_WORD: Record<Task['status'], string> = {
  queued: 'queued',
  running: 'running',
  waiting: 'waiting on you',
  ended: 'done',
  stopped: 'stopped',
  failed: 'failed',
};

export function money(dollars: number): string {
  return `$${dollars.toFixed(4)}`;
}

/** The small capitals that name a block: YOU, THINKING, SEARCH … */
function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <p className={cn('font-mono text-xs tracking-widest text-faint uppercase', className)}>
      {children}
    </p>
  );
}

export function StatusWord({ status }: { status: Task['status'] }): JSX.Element {
  return (
    <span className={cn('font-mono text-xs tracking-wider uppercase', STATUS_TONE[status])}>
      {STATUS_WORD[status]}
    </span>
  );
}

/**
 * The steps of one task, in order: what it was asked, what it thought, what it
 * ran, what it handed down, what it answered. The order is the reasoning, so
 * this is the main column and the tree beside it is only the way around.
 */
export function StepStream({
  task,
  steps,
  tasks,
  onSelect,
}: {
  task: Task;
  steps: readonly Step[];
  tasks: readonly Task[];
  onSelect: (taskId: string) => void;
}): JSX.Element {
  const children = tasks.filter((candidate) => candidate.parentId === task.id);
  const handedDown = childrenByStep(
    steps.filter((step) => step.kind === 'delegate'),
    children,
  );
  return (
    <ol className="divide-y divide-border">
      {/* What the task was asked is its title: the question for the lead, the
          delegated part for a reader. It opens the stream the way YOU does. */}
      <li className="border-l-2 border-primary bg-accent/40 px-4 py-3">
        <Eyebrow className="text-primary">
          {task.parentId === null ? 'you' : `to ${task.agent}`}
        </Eyebrow>
        <p className="mt-1 font-mono text-sm text-ink">{task.title}</p>
      </li>
      {steps.map((step) => (
        <StepBlock
          key={step.index}
          step={step}
          delegated={handedDown.get(step.index) ?? []}
          onSelect={onSelect}
        />
      ))}
      {steps.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted-foreground">Nothing yet.</li>
      ) : null}
    </ol>
  );
}

function StepBlock({
  step,
  delegated,
  onSelect,
}: {
  step: Step;
  delegated: readonly Task[];
  onSelect: (taskId: string) => void;
}): JSX.Element {
  switch (step.kind) {
    case 'you':
      return (
        <li className="border-l-2 border-primary bg-accent/40 px-4 py-3">
          <Eyebrow className="text-primary">you</Eyebrow>
          <p className="mt-1 font-mono text-sm text-ink">{step.text}</p>
        </li>
      );
    case 'thinking':
      return (
        <li className="border-l-2 border-rule-strong px-4 py-3">
          <Eyebrow>thinking</Eyebrow>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{step.text}</p>
        </li>
      );
    case 'tool': {
      const parsed = toolLabel(step.text);
      const detail = step.detail;
      // What it took and what it cost, at the right of the label, as the spec has it.
      const receipt = [
        detail?.durationMs === undefined ? null : took(detail.durationMs),
        detail?.cost ? money(detail.cost.dollars) : null,
      ].filter((part): part is string => part !== null);
      return (
        <li className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>{detail?.tool ?? parsed.label}</Eyebrow>
            {receipt.length > 0 ? <Eyebrow>{receipt.join(' · ')}</Eyebrow> : null}
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{parsed.body}</p>
          {detail?.rows && detail.rows.length > 0 ? (
            <ul className="mt-2 divide-y divide-border">
              {detail.rows.map((row, index) => (
                <li key={index} className="flex items-baseline gap-3 py-2">
                  <span
                    className={cn(
                      'w-16 shrink-0 rounded-sm border px-1.5 py-0.5 text-center font-mono text-xs tracking-wider uppercase',
                      row.empty ? 'border-decide text-decide' : 'border-rule-strong text-faint',
                    )}
                  >
                    {row.source}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-sm text-body">{row.text}</span>
                  <span
                    className={cn(
                      'shrink-0 text-sm',
                      row.empty ? 'text-decide' : 'text-muted-foreground',
                    )}
                  >
                    {row.result}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {detail?.output ? (
            <pre className="mt-2 overflow-x-auto rounded-sm bg-sunken px-3 py-2 font-mono text-sm text-body">
              {detail.output}
            </pre>
          ) : null}
        </li>
      );
    }
    case 'delegate':
      return (
        <li className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>delegated</Eyebrow>
            <Eyebrow>{step.text.replace(/^delegated\s+/i, '')}</Eyebrow>
          </div>
          <ul className="mt-2 divide-y divide-border rounded-sm bg-sunken">
            {delegated.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onSelect(child.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                >
                  <span className="w-24 shrink-0 font-mono text-sm text-ink">{child.agent}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {child.title}
                  </span>
                  <StatusWord status={child.status} />
                </button>
              </li>
            ))}
          </ul>
        </li>
      );
    case 'reply':
      return (
        <li className="px-4 py-3">
          <Eyebrow className="text-keep">reply</Eyebrow>
          <p className="mt-1 text-sm text-ink">{step.text}</p>
        </li>
      );
  }
}

/** The way around: every task, where it hangs, and how it ended. */
export function CallTree({
  tasks,
  totals,
  selected,
  onSelect,
}: {
  tasks: readonly Task[];
  totals: Readonly<Record<string, { dollars: number }>>;
  selected: string | null;
  onSelect: (taskId: string) => void;
}): JSX.Element {
  return (
    <ul>
      {treeRows(tasks).map(({ task, branch }) => (
        <li key={task.id}>
          <button
            type="button"
            aria-current={task.id === selected ? 'true' : undefined}
            onClick={() => onSelect(task.id)}
            title={`${task.title}\nown ${money(task.ownCost.dollars)} · with everything under it ${money(totals[task.id]?.dollars ?? 0)}`}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left font-mono text-sm hover:bg-accent',
              task.id === selected ? 'bg-accent text-primary' : 'text-body',
            )}
          >
            <span className="min-w-0 truncate">
              <span className="whitespace-pre text-faint">{branch}</span>
              {task.agent}
            </span>
            <StatusWord status={task.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What the session has kept. Choosing one opens the task that recorded it. */
export function Findings({
  findings,
  tasks,
  onSelect,
}: {
  findings: readonly SessionFinding[];
  tasks: readonly Task[];
  onSelect: (taskId: string) => void;
}): JSX.Element {
  if (findings.length === 0) {
    return <p className="px-2 text-sm text-muted-foreground">Nothing recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {findings.map((finding) => (
        <li key={finding.id}>
          <button
            type="button"
            onClick={() => onSelect(finding.taskId)}
            className="w-full rounded-sm px-2 py-2 text-left hover:bg-accent"
          >
            <Eyebrow className="text-keep">
              {tasks.find((task) => task.id === finding.taskId)?.agent ?? 'recorded'}
            </Eyebrow>
            <p className="mt-1 font-mono text-sm text-body">{finding.text}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * LI ZHUOYANG's. One row at the foot of the stream, as in the spec: attach,
 * say, send. Today it says a new turn to the lead. Steering a task that is
 * still running, and the "+", arrive with the steering slice.
 */
export function Composer({
  disabled,
  onSay,
}: {
  disabled: boolean;
  onSay: (text: string) => void;
}): JSX.Element {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get('say');
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return;
    onSay(text);
    form.reset();
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
      <Button type="button" variant="ghost" size="icon" disabled aria-label="Attach a file">
        <Plus />
      </Button>
      <Input
        name="say"
        aria-label="Say something to the lead"
        placeholder="Say something to the lead…"
        className="font-mono"
        autoComplete="off"
      />
      <Button type="submit" variant="ghost" size="icon" disabled={disabled} aria-label="Send">
        <SendHorizontal />
      </Button>
    </form>
  );
}
