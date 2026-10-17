// The pieces of the Session page, after docs/spec, page 04, in the Raster
// look. Owner: LIU ZIYANG, except
// Composer and Files, which are LI ZHUOYANG's: the composer says a new turn to
// the lead, or steers the task shown while it runs; the files panel lists what
// the project has written. Attachments are still his to add.
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import type { ClientCommand, Step, Task } from '@lumen/contracts';
import { cn } from '@/lib/utils';
import { ReplyText } from './text';
import { Button } from '@/ui/button';
import { Composer as Field, type ComposerMode } from '@/ui/composer';
import { RunState, type Run } from '@/ui/run-state';
import type { SessionFinding } from '@/core/api';
import { childrenByStep, speakerNames, took, toolLabel, treeRows, turnToSend } from './tree';

// Raster has four run marks and the contract has six statuses. A queued task
// has not started and a failed one ended before its work did: both are quiet
// rings, and the word says which. Red stays for "waiting", the one status
// that needs the person.
const RUN: Record<Task['status'], { readonly state: Run; readonly word?: string }> = {
  queued: { state: 'stopped', word: 'Queued' },
  running: { state: 'running' },
  waiting: { state: 'waiting' },
  ended: { state: 'finished' },
  stopped: { state: 'stopped' },
  failed: { state: 'stopped', word: 'Failed' },
};

/** Four decimals, always: two once showed a $0.006 cap as "$0.01" (see contracts/tasks.ts). */
export function money(dollars: number): string {
  return `$${dollars.toFixed(4)}`;
}

/** A task's status as the one run mark the product uses: a circle and a word. */
export function TaskState({
  status,
  className,
}: {
  status: Task['status'];
  className?: string;
}): JSX.Element {
  const run = RUN[status];
  return (
    <RunState state={run.state} className={className}>
      {run.word}
    </RunState>
  );
}

/** The name a person reads for a task: 'lumen' for the lead, 'reader 2' for a child. */
function speaker(task: Task, tasks: readonly Task[]): string {
  return speakerNames(tasks).get(task.id) ?? task.agent;
}

type Turn =
  | { readonly who: 'you'; readonly key: string; readonly label: string; readonly text: string }
  | { readonly who: 'agent'; readonly key: string; readonly steps: Step[] };

/**
 * The steps of one task as a conversation. What the task was asked opens it
 * (the question for the lead, the delegated part for a child), each later
 * `you` step is a new turn of the person, and everything between two of them
 * is one turn of the agent. The order is the reasoning, so this is the main
 * surface and the call tree is only the way around.
 */
function turnsOf(task: Task, steps: readonly Step[]): Turn[] {
  const turns: Turn[] = [
    {
      who: 'you',
      key: 'asked',
      label: task.parentId === null ? 'You' : 'Task',
      text: task.title,
    },
  ];
  for (const step of steps) {
    if (step.kind === 'you') {
      turns.push({ who: 'you', key: `s${step.index}`, label: 'You', text: step.text });
      continue;
    }
    const last = turns[turns.length - 1];
    if (last?.who === 'agent') last.steps.push(step);
    else turns.push({ who: 'agent', key: `s${step.index}`, steps: [step] });
  }
  return turns;
}

/**
 * The conversation of one task. It renders the turns straight into the
 * scrolling region, without a wrapper of its own, so that the latest exchange
 * (the person's last turn and what followed) can be at least as tall as the
 * region (`min-h-full`). The region opens at its end, and that one rule gives
 * the opening the prototype asks for: the start of the person's latest turn at
 * the top when the exchange fits the screen, and the end of it when it is
 * taller.
 */
export function StepStream({
  task,
  steps,
  tasks,
  note,
  onSelect,
}: {
  task: Task;
  steps: readonly Step[];
  tasks: readonly Task[];
  /** A quiet line under the opening turn: how the session was started. */
  note?: string;
  onSelect: (taskId: string) => void;
}): JSX.Element {
  const children = tasks.filter((candidate) => candidate.parentId === task.id);
  const handedDown = childrenByStep(
    steps.filter((step) => step.kind === 'delegate'),
    children,
  );
  const turns = turnsOf(task, steps);
  let latest = 0;
  turns.forEach((turn, index) => {
    if (turn.who === 'you') latest = index;
  });

  const draw = (turn: Turn, index: number): JSX.Element => (
    <article
      key={turn.key}
      className={cn('py-6 max-roomy:py-4', index > 0 && 'border-t border-rule-minor')}
    >
      <h2 className="pt-1 pb-2 text-sm font-semibold text-ink">
        {turn.who === 'you' ? turn.label : speaker(task, tasks)}
      </h2>
      {turn.who === 'you' ? (
        <div data-step="you" className="bg-well p-4">
          <p className="font-medium break-words text-ink">{turn.text}</p>
          {index === 0 && note ? <p className="mt-1 text-caption text-ink-2">{note}</p> : null}
        </div>
      ) : (
        <AgentTurn
          steps={turn.steps}
          handedDown={handedDown}
          names={speakerNames(tasks)}
          onSelect={onSelect}
        />
      )}
    </article>
  );

  return (
    <>
      {turns.slice(0, latest).map(draw)}
      <div data-latest="" className="min-h-full">
        {turns.slice(latest).map((turn, offset) => draw(turn, latest + offset))}
        {steps.length === 0 ? (
          <article className="border-t border-rule-minor py-6 max-roomy:py-4">
            <h2 className="pt-1 pb-2 text-sm font-semibold text-ink">{speaker(task, tasks)}</h2>
            <p className="text-sm text-ink-2">Nothing yet.</p>
          </article>
        ) : null}
      </div>
    </>
  );
}

/**
 * One turn of an agent. The work before a reply hangs on one thin rule, so it
 * reads as one block of steps and the reply below it reads as the answer. A
 * turn that works again after a reply starts a second block.
 */
function AgentTurn({
  steps,
  handedDown,
  names,
  onSelect,
}: {
  steps: readonly Step[];
  handedDown: Map<number, readonly Task[]>;
  names: Map<string, string>;
  onSelect: (taskId: string) => void;
}): JSX.Element {
  const parts: ({ kind: 'work'; steps: Step[] } | { kind: 'reply'; step: Step })[] = [];
  for (const step of steps) {
    const last = parts[parts.length - 1];
    if (step.kind === 'reply') parts.push({ kind: 'reply', step });
    else if (last?.kind === 'work') last.steps.push(step);
    else parts.push({ kind: 'work', steps: [step] });
  }
  return (
    <div className="min-w-0">
      {parts.map((part, index) =>
        part.kind === 'reply' ? (
          // The reply stands under the work, off its rule, with a label of
          // its own and the same text width as the thinking above it, so it
          // reads as this turn's answer and not as a different component.
          <section
            key={`r${part.step.index}`}
            data-step="reply"
            className={cn('break-words text-ink', index > 0 && 'mt-8')}
          >
            <div className={PROSE}>
              <ReplyText text={part.step.text} />
            </div>
          </section>
        ) : (
          <div
            key={`w${part.steps[0]?.index ?? index}`}
            className={cn('space-y-4 border-l border-rule-minor pl-4', index > 0 && 'mt-10')}
          >
            {part.steps.map((step) => (
              <StepBlock
                key={step.index}
                step={step}
                delegated={handedDown.get(step.index) ?? []}
                names={names}
                onSelect={onSelect}
              />
            ))}
          </div>
        ),
      )}
    </div>
  );
}

// One measure for prose in the conversation, thinking and answers alike, so
// the column has one text width. Only tables and output run the full width.
const PROSE = 'max-w-[40rem]';

/** What a tool step took and cost, beside its label. A free step shows no price. */
export function receiptOf(step: Step): string {
  const detail = step.detail;
  const parts = [
    detail?.durationMs === undefined ? null : took(detail.durationMs),
    detail?.cost && detail.cost.dollars > 0 ? money(detail.cost.dollars) : null,
  ].filter((part): part is string => part !== null);
  // The spec's word for a tool that reports neither: save, record.
  return parts.length > 0 ? parts.join(', ') : 'tool call';
}

/** The small label over a step, with what it took beside it in grey. */
function StepLabel({
  children,
  meta,
}: {
  children: ReactNode;
  meta?: string | undefined;
}): JSX.Element {
  return (
    <h3 className="mb-1 text-xs font-semibold text-ink">
      {children}
      {meta ? <span className="ml-2 font-normal text-ink-2 tabular-nums">{meta}</span> : null}
    </h3>
  );
}

// A row of a step: what was asked of a source, and what came back. The
// source takes a fixed column, so the queries line up; under 720px it moves
// to its own small line and the query and the result keep their two columns.
const ROW =
  'grid grid-cols-[7rem_minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-rule-minor py-1 text-sm first:border-t-0 max-roomy:grid-cols-[minmax(0,1fr)_auto]';
const ROW_SOURCE = 'truncate text-ink-2 max-roomy:col-span-full max-roomy:text-xs';

function StepBlock({
  step,
  delegated,
  names,
  onSelect,
}: {
  step: Step;
  delegated: readonly Task[];
  names: Map<string, string>;
  onSelect: (taskId: string) => void;
}): JSX.Element | null {
  switch (step.kind) {
    case 'you':
    case 'reply':
      // Turns of their own (turnsOf, AgentTurn): never a step inside the work.
      return null;
    case 'thinking':
      return (
        <section data-step="thinking">
          <StepLabel>Thinking</StepLabel>
          <p className={cn(PROSE, 'text-sm break-words text-ink-2')}>{step.text}</p>
        </section>
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
      const receipt = receiptOf(step);
      return (
        <section data-step="tool">
          {/* The tool's own name, as the agent called it: it is data, not copy. */}
          <StepLabel meta={receipt === 'tool call' ? undefined : receipt}>{name}</StepLabel>
          {carries ? null : <p className="text-sm break-words text-ink-2">{body}</p>}
          {detail?.rows && detail.rows.length > 0 ? (
            <ul>
              {/* The columns are named once, so "demo | is it named | no
                  recurrence" reads as a source, a question and an answer. */}
              <li aria-hidden="true" className={cn(ROW, 'text-xs text-ink-2 max-roomy:hidden')}>
                <span>Source</span>
                <span>Asked</span>
                <span className="justify-self-end">Found</span>
              </li>
              {detail.rows.map((row, index) => (
                <li key={index} className={ROW}>
                  <span className={ROW_SOURCE} title={row.source}>
                    {row.source}
                  </span>
                  {/* The row that found nothing says so in its own words, and in
                      words for a screen reader. It is not bold: a bold "nothing"
                      read as an alert. Not red either: red means "waits on you". */}
                  <span className="min-w-0 break-words text-ink">{row.text}</span>
                  <span
                    className={cn(
                      'max-w-[40ch] justify-self-end text-right break-words tabular-nums',
                      row.empty ? 'text-ink' : 'text-ink-2',
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
              className="max-h-80 overflow-auto border border-rule-minor bg-paper p-4 font-mono text-xs whitespace-pre text-ink tabular-nums"
            >
              {detail.output}
            </pre>
          ) : null}
        </section>
      );
    }
    case 'delegate':
      return (
        <section data-step="delegate">
          {/* The count comes from the tasks handed down, not from the step's
              text, which said "1 in parallel". */}
          <StepLabel
            meta={
              delegated.length === 0
                ? step.text.replace(/^delegated\s+/i, '')
                : delegated.length === 1
                  ? '1 task'
                  : `${delegated.length} in parallel`
            }
          >
            Delegated
          </StepLabel>
          <ul>
            {delegated.map((child) => (
              <li key={child.id} className="border-t border-rule-minor first:border-t-0">
                {/* Opens the child's own conversation. */}
                <button
                  type="button"
                  onClick={() => onSelect(child.id)}
                  className="group grid w-full grid-cols-[7rem_minmax(0,1fr)_auto] items-baseline gap-x-4 py-1 text-left text-sm max-roomy:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <span className={ROW_SOURCE}>{names.get(child.id) ?? child.agent}</span>
                  <span className="min-w-0 break-words text-ink decoration-[1.5px] underline-offset-[0.15em] group-hover:underline">
                    {child.title}
                  </span>
                  <TaskState status={child.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      );
  }
}

// One cell of a branch, 24px wide and as tall as the row, so the lines of
// one row meet the lines of the next and a subtree reads as one structure.
// The glyphs of treeRows say which lines a cell has: a trunk that goes on
// (│), a child that is not the last (├), the last child (└), or nothing.
// Text glyphs were short grey pieces that the row rules cut apart.
const TRUNK = 'before:absolute before:left-3 before:w-px before:bg-rule-major';
const TWIG =
  'after:absolute after:top-1/2 after:right-1 after:left-3 after:h-px after:bg-rule-major';
const CELL: Record<string, string> = {
  '│': cn(TRUNK, 'before:inset-y-0'),
  '├': cn(TRUNK, 'before:inset-y-0', TWIG),
  '└': cn(TRUNK, 'before:top-0 before:h-1/2', TWIG),
};

function Branch({ glyphs }: { glyphs: string }): JSX.Element | null {
  if (!glyphs) return null;
  // treeRows writes each level as a glyph and a space.
  const cells = glyphs.match(/.(?: |$)/gu) ?? [];
  return (
    <span aria-hidden="true" data-branch={glyphs} className="flex self-stretch">
      {cells.map((cell, index) => (
        <span key={index} className={cn('relative w-6 shrink-0', CELL[cell.trim()])} />
      ))}
    </span>
  );
}

// A row of a list on the well that opens something. Hover is a half step of
// the raised fill; the open row has the full fill and an ink rule on its
// left. Before, hover and open were the same white fill, and a hovered row
// looked open beside the one that was.
const WELL_ROW =
  'border-l-2 border-transparent text-left text-ink hover:bg-raised/50 aria-[current=true]:border-ink aria-[current=true]:bg-raised';

/** The way around: every task, where it hangs, what it has cost, and how it stands. */
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
  const names = speakerNames(tasks);
  return (
    <ul>
      {treeRows(tasks).map(({ task, branch }) => {
        const total = totals[task.id]?.dollars ?? 0;
        const current = task.id === selected;
        return (
          // A rule only above a task that hangs from the root: inside one
          // subtree the rows join, so the branch lines run unbroken.
          <li
            key={task.id}
            className={branch ? undefined : 'border-t border-rule-minor first:border-t-0'}
          >
            {/* The row keeps to the column, as wide as the rules between the
                rows: a highlight 8px wider than the rules read as a mistake. */}
            <button
              type="button"
              aria-current={current ? 'true' : undefined}
              onClick={() => onSelect(task.id)}
              title={task.title}
              className={cn(
                'flex min-h-8 w-full items-center justify-between gap-4 px-2 text-sm',
                WELL_ROW,
              )}
            >
              <span className="flex min-w-0 items-center self-stretch">
                <Branch glyphs={branch} />
                {/* The lead is a row like any other; only the open row is bold. */}
                <span className={cn('truncate py-1', current ? 'font-semibold' : 'font-normal')}>
                  {task.parentId === null ? 'lumen' : (names.get(task.id) ?? task.agent)}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                {/* With everything delegated under it. In the row, not in a tooltip,
                    which a keyboard or a touch screen never sees. */}
                {/* The cost column is there from the first frame, so the
                    rows do not change shape when the first cost arrives. */}
                <span className="text-sm text-ink-2 tabular-nums">{money(total)}</span>
                <TaskState status={task.status} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** How many findings the well shows before Show all: the tree and the files stay in view. */
const FIRST_FINDINGS = 3;

/**
 * Oldest first, and the same order on every load. The live events arrive
 * in the order the agents recorded them, but a page that loads later gets
 * the list back with ties in any order, so the newest-first list changed
 * order between two loads of a finished session. Ties now go in call-tree
 * order, which is also the order the tree in this well shows.
 */
export function inRecordOrder(
  findings: readonly SessionFinding[],
  tasks: readonly Task[],
): SessionFinding[] {
  const place = new Map(treeRows(tasks).map((row, index) => [row.task.id, index]));
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        (a.finding.createdAt ?? Infinity) - (b.finding.createdAt ?? Infinity) ||
        (place.get(a.finding.taskId) ?? 0) - (place.get(b.finding.taskId) ?? 0) ||
        a.index - b.index,
    )
    .map(({ finding }) => finding);
}

/**
 * What the session has kept, newest first. Choosing one opens the task that
 * recorded it, and the finding stays marked, so it is clear which finding
 * the conversation now shows the source of. The contract carries no verdict
 * and no evidence yet, so a finding is its claim and who recorded it,
 * without a Verdict mark.
 */
export function Findings({
  findings,
  tasks,
  selected,
  onSelect,
}: {
  /** Oldest first, as the page state keeps them. */
  findings: readonly SessionFinding[];
  tasks: readonly Task[];
  /** The finding last chosen, if the conversation still shows its task. */
  selected?: string | null;
  onSelect: (findingId: string, taskId: string) => void;
}): JSX.Element {
  const [all, setAll] = useState(false);
  if (findings.length === 0) {
    return <p className="text-sm text-ink-2">None yet.</p>;
  }
  const names = speakerNames(tasks);
  const newest = inRecordOrder(findings, tasks).reverse();
  const shown = all ? newest : newest.slice(0, FIRST_FINDINGS);
  return (
    <>
      <ul>
        {shown.map((finding) => {
          const current = finding.id === selected;
          return (
            <li key={finding.id} className="border-t border-rule-minor first:border-t-0">
              <button
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => onSelect(finding.id, finding.taskId)}
                className={cn('w-full px-2 py-3', WELL_ROW)}
              >
                {/* Regular weight, clamped: a column of bold paragraphs was
                    a wall. The chosen one opens in full. No underline on
                    hover: through two lines of text it cut the letters and
                    was louder than any other state. */}
                <p className={cn('text-sm break-words text-ink', !current && 'line-clamp-3')}>
                  {finding.text}
                </p>
                <p className="mt-1 text-caption text-ink-2">
                  Recorded by <span>{names.get(finding.taskId) ?? 'an agent'}</span>
                  {current ? '. Its conversation is open.' : null}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {newest.length > FIRST_FINDINGS ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${newest.length}`}
        </Button>
      ) : null}
    </>
  );
}

/** A file or folder the project has written, as the files route lists it. */
export interface ProjectFile {
  readonly name: string;
  readonly virtualPath: string;
  readonly kind: 'file' | 'directory';
  readonly modifiedAt: number;
}

/** LI ZHUOYANG's. What the project has written to its output, newest first. */
/**
 * What the project kept: /mnt/output, newest first. The agents are told to
 * save what is worth keeping there; their scratch (/mnt/workspace) belongs to
 * one session and is not listed. A file opens in a new tab from steering's
 * files route, which it never did before; a folder is only named.
 */
export function Files({
  files,
  projectId,
}: {
  files: readonly ProjectFile[] | 'failed';
  projectId?: string | undefined;
}): JSX.Element {
  if (files === 'failed') {
    return <p className="text-sm text-ink-2">The files could not be read.</p>;
  }
  if (files.length === 0) return <p className="text-sm text-ink-2">None yet.</p>;
  return (
    <ul>
      {[...files]
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .map((file) => {
          const name = file.virtualPath.replace(/^\/mnt\/output\//, '');
          const label = (
            <>
              {name}
              {file.kind === 'directory' ? '/' : ''}
            </>
          );
          return (
            <li
              key={file.virtualPath}
              className="border-t border-rule-minor py-1 font-mono text-xs break-all text-ink first:border-t-0"
            >
              {projectId && file.kind === 'file' ? (
                <a
                  href={`/api/projects/${encodeURIComponent(projectId)}/files/${file.virtualPath.replace(/^\/mnt\//, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {label}
                </a>
              ) : (
                <span>{label}</span>
              )}
            </li>
          );
        })}
    </ul>
  );
}

/**
 * The task shown is waiting for the owner: the guard escalated its next
 * operation. The decision is taken on the Wallet page (billing's), so this
 * says so and points there; the task resumes on its own once granted. It is
 * the one red edge on the page, because it is the one thing that waits on you.
 */
export function WaitingNotice({ task }: { task: Task }): JSX.Element | null {
  if (task.status !== 'waiting') return null;
  return (
    <p role="status" className="mb-4 border-l-2 border-signal bg-well p-4 text-sm text-ink">
      <span className="font-semibold">This task waits on you.</span> It is over the cap and needs
      your approval.{' '}
      <a href="#/settings" className="font-medium underline underline-offset-2">
        Decide in Wallet
      </a>
      . It continues on its own once granted.
    </p>
  );
}

/** The largest file Attach sends; steering's upload route refuses more. */
const ATTACH_LIMIT = 10 * 1024 * 1024;

/** How long an armed Stop waits for the second click before it is quiet again. */
const ARMED_MS = 4000;

/**
 * Stop, in the bar. It is an outlined square and a word until the first
 * click arms it; armed, it is solid ink and asks "Stop now?", and the
 * second click stops the run. A stop cannot be undone from here,
 * so one stray click must not end a run. Escape, a click anywhere else, or
 * four seconds disarm it.
 */
export function StopControl({
  onStop,
  disabled,
}: {
  onStop: () => void;
  disabled: boolean;
}): JSX.Element {
  const [armed, setArmed] = useState(false);
  const self = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARMED_MS);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setArmed(false);
    };
    const onPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || !self.current?.contains(event.target)) {
        setArmed(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [armed]);
  // Armed, a Cancel stands before it, so the way out is visible and not only
  // Escape or a click elsewhere. Cancel is on the left so "Stop now?" grows
  // leftward from where Stop was and stays under the pointer.
  return (
    <span ref={self} className="flex items-center gap-2">
      {armed ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={armed ? 'default' : 'outline'}
        disabled={disabled}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          onStop();
        }}
        // The same outlined button at every width. It was bare text on a
        // desktop and outlined on a phone, so the one control that ends a
        // run looked weak where most people use it.
        className="px-3 has-[>span]:px-3"
      >
        <span aria-hidden="true" className="size-2 shrink-0 bg-current" />
        {armed ? 'Stop now?' : 'Stop'}
      </Button>
    </span>
  );
}

export type SteerWhen = Extract<ClientCommand, { type: 'task.steer' }>['when'];

// When a steer lands, as the composer's modes: two words a person can see at
// once, instead of a menu they have to open.
const TIMING: readonly (ComposerMode & { readonly value: SteerWhen })[] = [
  { value: 'next-step', label: 'At its next step' },
  { value: 'end-of-turn', label: 'At the end of its turn' },
];

/**
 * LI ZHUOYANG's. The one field at the foot of the conversation (ui/composer):
 * it says a new turn to the lead, or, while a run is going, steers the task
 * shown, at its next step or at the end of its turn. Stop is in the bar.
 */
export function Composer({
  disabled,
  running,
  steerable,
  onSay,
  onSteer,
  shownAgent = null,
  onAttach,
}: {
  /** The socket is down or the account is not ready: nothing can be sent. */
  disabled: boolean;
  /** The root is busy: the field steers, and a fresh session.say is not offered. */
  running: boolean;
  /** The task currently shown is itself running: steering it means something right now. */
  steerable: boolean;
  onSay: (text: string) => void;
  onSteer: (text: string, when: SteerWhen) => void;
  /**
   * The name of the task shown when it is not the lead, for example
   * "reader 2". A new turn always goes to the lead, so the field says so
   * there instead of "Reply to lumen", which read as a reply to the reader.
   */
  shownAgent?: string | null;
  /**
   * Saves a file to the project's /mnt/upload and resolves with its path.
   * The next message says where it is, so lumen reads it; without that, an
   * attachment would sit in a folder nobody was told about.
   */
  onAttach?: ((file: File) => Promise<string>) | undefined;
}): JSX.Element {
  const [when, setWhen] = useState<SteerWhen>('next-step');
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<readonly string[]>([]);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  // Blocked for a reason a run.status can change without a fresh render of
  // this form's own props, so this is computed at submit time, not baked into
  // one boolean passed in.
  const blocked = disabled || (running && !steerable);
  function submit(): void {
    // Enter submits too. Nothing is sent, and the text is kept, while the
    // socket is down, or the root is busy with a task that is not the one
    // shown (there is nothing here to steer).
    const typed = turnToSend(draft || (attached.length ? 'Read what I attached.' : ''), blocked);
    if (typed === null) return;
    const text = attached.length ? `${typed}\n\nAttached: ${attached.join(', ')}` : typed;
    if (running) onSteer(text, when);
    else onSay(text);
    // Clear only the message: the timing remains selected for the next steer.
    setDraft('');
    setAttached([]);
    setAttachNote(null);
  }
  function attach(file: File): void {
    if (!onAttach) return;
    // The upload route takes up to 10 MB; saying so here beats the server's
    // "Request body is too large".
    if (file.size > ATTACH_LIMIT) {
      setAttachNote(`${file.name} is larger than 10 MB, the most one file can be.`);
      return;
    }
    setAttachNote(`Attaching ${file.name}…`);
    onAttach(file).then(
      (path) => {
        setAttached((list) => [...list, path]);
        setAttachNote(null);
      },
      (error: unknown) =>
        setAttachNote(
          `${file.name} was not attached: ${error instanceof Error ? error.message : 'the upload failed'}.`,
        ),
    );
  }
  const hint = attachNote
    ? attachNote
    : attached.length
      ? `Attached ${attached.map((path) => path.replace(/^\/mnt\/upload\//, '')).join(', ')}. It goes with your next message.`
      : disabled
        ? 'Not connected. Your message stays here until lumen is back.'
        : running
          ? steerable
            ? when === 'next-step'
              ? 'Read at its next step.'
              : 'Read at the end of its turn.'
            : 'Only a running task can be steered. Open one in the call tree.'
          : shownAgent
            ? `Ended. A reply goes to lumen, not to ${shownAgent}.`
            : 'Ended. A reply starts a new turn.';
  return (
    <Field
      name="say"
      label={running ? 'Steer the task shown' : shownAgent ? 'Reply to lumen' : 'Reply to lumen'}
      placeholder={
        running
          ? steerable
            ? when === 'next-step'
              ? 'Steer this task before its next step…'
              : 'Steer this task at the end of its turn…'
            : 'This task is not running, so there is nothing to steer'
          : shownAgent
            ? 'Reply to lumen'
            : 'Reply to lumen'
      }
      value={draft}
      onValueChange={setDraft}
      onSubmit={submit}
      // While a run is going, the timing is part of what is sent: it cannot
      // be chosen while nothing can be sent. The text stays typeable while
      // the socket is down, so a steer can be drafted for when it is back.
      // A new turn has no timing at all.
      {...(running ? { modes: TIMING } : {})}
      modesLabel="lumen reads it"
      modesLabelVisible
      modesDisabled={blocked}
      mode={when}
      onModeChange={(value) => {
        if (value === 'next-step' || value === 'end-of-turn') setWhen(value);
      }}
      // Only a task that is not running has nothing to steer at all.
      disabled={running && !steerable}
      sendDisabled={blocked}
      sendLabel={running ? 'Steer' : 'Send'}
      hint={hint}
      {...(onAttach ? { onAttach: attach } : {})}
    />
  );
}
