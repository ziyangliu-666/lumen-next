// The pieces of the Session page, after docs/spec, page 04. Owner: LIU ZIYANG,
// except Composer, which is LI ZHUOYANG's: it sits where the spec puts it, it
// says a new turn to the lead and stops a run, and steering a running task and
// attachments are his to add.
import type { FormEvent, JSX, ReactNode } from 'react';
import type { Step, Task } from '@lumen/contracts';
import { cn } from 'cn';
import { Plus, SendHorizontal, Square } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import type { SessionFinding } from '@/core/api';
import { childrenByStep, took, toolLabel, treeRows, turnToSend } from './tree';

// One tint per task status, from the theme, so a status means the same colour
// here as on the project card. The word is always there too: colour is never
// the only thing that says it.
const STATUS_TONE: Record<Task['status'], string> = {
  queued: 'text-muted-foreground',
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

/** Four decimals, always: two once showed a $0.006 cap as "$0.01" (see contracts/tasks.ts). */
export function money(dollars: number): string {
  return `$${dollars.toFixed(4)}`;
}

/**
 * The small capitals that name a block: YOU, THINKING, SEARCH … Muted, not
 * faint: at this size the faintest grey is under the contrast a label needs.
 */
function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <p
      className={cn('font-mono text-xs tracking-widest text-muted-foreground uppercase', className)}
    >
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
          delegated part for a child. It opens the stream the way YOU does. */}
      <li className="border-l-2 border-primary bg-accent/40 px-4 py-3">
        <Eyebrow className="text-primary">{task.parentId === null ? 'you' : 'task'}</Eyebrow>
        <p className="mt-1 font-mono text-sm break-words text-ink">{task.title}</p>
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

/** What a tool step took and cost, for the right of its label. A free step shows no price. */
export function receiptOf(step: Step): string {
  const detail = step.detail;
  const parts = [
    detail?.durationMs === undefined ? null : took(detail.durationMs),
    detail?.cost && detail.cost.dollars > 0 ? money(detail.cost.dollars) : null,
  ].filter((part): part is string => part !== null);
  // The spec's word for a tool that reports neither: save, record.
  return parts.length > 0 ? parts.join(' · ') : 'tool call';
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
          <p className="mt-1 font-mono text-sm break-words text-ink">{step.text}</p>
        </li>
      );
    case 'thinking':
      return (
        <li className="border-l-2 border-rule-strong bg-ground px-4 py-3">
          <Eyebrow>thinking</Eyebrow>
          <p className="mt-1 font-mono text-sm break-words text-muted-foreground">{step.text}</p>
        </li>
      );
    case 'tool': {
      const detail = step.detail;
      const parsed = toolLabel(step.text);
      const name = detail?.tool ?? parsed.label;
      // The line of text is what a step says when it carries nothing else. With
      // rows or output to show, the spec shows those and no line above them.
      const carries = Boolean(detail?.rows?.length) || Boolean(detail?.output);
      const body = step.text.startsWith(`${name}:`)
        ? step.text.slice(name.length + 1).trim()
        : parsed.body;
      return (
        <li className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>{name}</Eyebrow>
            <Eyebrow>{receiptOf(step)}</Eyebrow>
          </div>
          {carries ? null : (
            <p className="mt-1 font-mono text-sm break-words text-muted-foreground">{body}</p>
          )}
          {detail?.rows && detail.rows.length > 0 ? (
            <ul className="mt-2 divide-y divide-border">
              {detail.rows.map((row, index) => (
                <li key={index} className="flex items-baseline gap-3 py-2">
                  <span
                    className={cn(
                      'w-16 shrink-0 truncate rounded-sm border px-1.5 py-0.5 text-center font-mono text-xs tracking-wider uppercase',
                      row.empty
                        ? 'border-decide text-decide'
                        : 'border-rule-strong text-muted-foreground',
                    )}
                    title={row.source}
                  >
                    {row.source}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-sm break-words text-body">
                    {row.text}
                  </span>
                  {/* The row that found nothing is often the one that matters. It is
                      marked by weight and by words for a screen reader, not by colour alone. */}
                  <span
                    className={cn(
                      'max-w-2/5 shrink-0 text-right text-sm break-words',
                      row.empty ? 'font-semibold text-decide' : 'text-muted-foreground',
                    )}
                  >
                    {row.empty ? <span className="sr-only">found nothing: </span> : null}
                    {row.result}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {detail?.output ? (
            // A terminal can print a great deal. The block scrolls; the page does not grow with it.
            // A block that scrolls must take the focus, or a keyboard cannot scroll it.
            <pre
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              role="region"
              aria-label={`${name} output`}
              className="mt-2 max-h-80 overflow-auto rounded-sm bg-sunken px-3 py-2 font-mono text-sm text-body"
            >
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
            <span className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-xs tracking-wider text-accent-foreground uppercase">
              {step.text.replace(/^delegated\s+/i, '')}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-border rounded-sm bg-sunken">
            {delegated.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onSelect(child.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="w-24 shrink-0 truncate font-mono text-sm text-ink">
                    {child.agent}
                  </span>
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
        <li className="border-l-2 border-ink px-4 py-3">
          <Eyebrow className="text-ink">reply</Eyebrow>
          <p className="mt-1 text-sm break-words text-ink">{step.text}</p>
        </li>
      );
  }
}

/** The way around: every task, where it hangs, what it has cost, and how it ended. */
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
      {treeRows(tasks).map(({ task, branch }) => {
        const total = totals[task.id]?.dollars ?? 0;
        return (
          <li key={task.id}>
            <button
              type="button"
              aria-current={task.id === selected ? 'true' : undefined}
              onClick={() => onSelect(task.id)}
              title={task.title}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left font-mono text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                task.id === selected ? 'bg-accent text-primary' : 'text-body',
              )}
            >
              <span className="min-w-0 truncate">
                <span className="whitespace-pre text-muted-foreground" aria-hidden="true">
                  {branch}
                </span>
                {task.agent}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                {/* With everything delegated under it. In the row, not in a tooltip,
                    which a keyboard or a touch screen never sees. */}
                {total > 0 ? (
                  <span className="text-xs text-muted-foreground">{money(total)}</span>
                ) : null}
                <StatusWord status={task.status} />
              </span>
            </button>
          </li>
        );
      })}
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
            className="w-full rounded-sm px-2 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <Eyebrow className="text-keep">
              {tasks.find((task) => task.id === finding.taskId)?.agent ?? 'recorded'}
            </Eyebrow>
            <p className="mt-1 font-mono text-sm break-words text-body">{finding.text}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * LI ZHUOYANG's. One box at the foot of the stream, as in the spec: attach,
 * say, and one button that sends, or stops the run while there is one. Steering
 * a task that is still running, and the "+", arrive with the steering slice.
 */
export function Composer({
  disabled,
  running,
  onSay,
  onStop,
}: {
  disabled: boolean;
  running: boolean;
  onSay: (text: string) => void;
  onStop: () => void;
}): JSX.Element {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get('say');
    // A form with one field and no submit button still submits on Enter, and
    // while a run is going the only button is Stop. So the rule is here, not in
    // which button is drawn: nothing is sent, and the text is kept, while a run
    // is going or the socket is down.
    const text = turnToSend(value, disabled || running);
    if (text === null) return;
    onSay(text);
    form.reset();
  }
  return (
    <form onSubmit={submit} className="border-t border-border p-3">
      <div className="flex items-center gap-1 rounded-md border border-rule-strong bg-sunken px-1 focus-within:border-primary">
        <Button type="button" variant="ghost" size="icon-sm" disabled aria-label="Attach a file">
          <Plus />
        </Button>
        {/* The box around it carries the border and the focus colour. */}
        <Input
          name="say"
          aria-label="Say something to the lead"
          placeholder="Say something to the lead…"
          autoComplete="off"
          className="h-10 flex-1 border-0 px-1 font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled}
            onClick={onStop}
            aria-label="Stop"
          >
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon-sm" disabled={disabled} aria-label="Send">
            <SendHorizontal />
          </Button>
        )}
      </div>
    </form>
  );
}
