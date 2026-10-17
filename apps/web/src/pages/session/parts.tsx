// The pieces of the Session page, after docs/spec, page 04, in the Raster
// look. Owner: LIU ZIYANG, except
// Composer and Files, which are LI ZHUOYANG's: the composer says a new turn to
// the lead, or steers the task shown while it runs, and attaches a file; the
// files panel lists what the person attached and what the agents wrote.
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import type { ClientCommand, Step, StepRow, Task } from '@lumen/contracts';
import { cn } from '@/lib/utils';
import { ReplyText } from './text';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Composer as Field } from '@/ui/composer';
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
  onRetry,
  onEdit,
}: {
  task: Task;
  steps: readonly Step[];
  tasks: readonly Task[];
  /** A quiet line under the opening turn: how the session was started. */
  note?: string;
  onSelect: (taskId: string) => void;
  /**
   * Asks the person's latest message again, as a new turn. Given only when a
   * new turn can be sent; drawn under the latest answer.
   */
  onRetry?: ((text: string) => void) | undefined;
  /** Puts the person's latest message back in the field, to change and send. */
  onEdit?: ((text: string) => void) | undefined;
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
  const asked = turns[latest];
  const lastText = asked?.who === 'you' ? asked.text : '';
  const lastAgent = turns.length - 1;

  const draw = (turn: Turn, index: number): JSX.Element => (
    <article
      key={turn.key}
      className={cn('py-6 max-roomy:py-4', index > 0 && 'border-t border-rule-minor')}
    >
      <h2 className="pt-1 pb-2 text-sm font-semibold text-ink">
        {turn.who === 'you' ? turn.label : speaker(task, tasks)}
      </h2>
      {turn.who === 'you' ? (
        <>
          <div data-step="you" className="bg-well p-4">
            <p className="font-medium break-words whitespace-pre-wrap text-ink">{turn.text}</p>
            {index === 0 && note ? <p className="mt-1 text-caption text-ink-2">{note}</p> : null}
          </div>
          {index === latest && onEdit ? (
            <TurnActions
              className="mx-0 justify-end"
              actions={[
                { key: 'edit', label: 'Edit', icon: <EditIcon />, run: () => onEdit(turn.text) },
              ]}
            />
          ) : null}
        </>
      ) : (
        <AgentTurn
          steps={turn.steps}
          handedDown={handedDown}
          names={speakerNames(tasks)}
          onSelect={onSelect}
          {...(index === lastAgent && onRetry && lastText
            ? { onRetry: () => onRetry(lastText) }
            : {})}
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
  onRetry,
}: {
  steps: readonly Step[];
  handedDown: Map<number, readonly Task[]>;
  names: Map<string, string>;
  onSelect: (taskId: string) => void;
  /** Given on the latest turn: Regenerate under its last answer. */
  onRetry?: () => void;
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
            <ReplyActions
              text={part.step.text}
              {...(onRetry && index === parts.length - 1 ? { onRetry } : {})}
            />
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

function CopyIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path d="M7 7h9v9H7z M4 13V4h9" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function LinkIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d="M8.5 11.5l3-3M9 5.5l1.2-1.2a3 3 0 0 1 4.3 4.3L13.3 9.8M11 14.5l-1.2 1.2a3 3 0 0 1-4.3-4.3l1.2-1.2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DoneIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function RetryIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9M15.5 4v3.5H12"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d="M4 16h3l8.5-8.5-3-3L4 13v3zM11 6l3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface TurnAction {
  readonly key: string;
  readonly label: string;
  readonly icon: JSX.Element;
  /** Resolves once done; a copy then shows a tick for a moment. */
  readonly run: () => void | Promise<void>;
  readonly ticks?: boolean;
}

/** A row of quiet icon buttons under a turn, each named in a tooltip. */
function TurnActions({
  actions,
  className,
}: {
  actions: readonly TurnAction[];
  className?: string;
}): JSX.Element {
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 1500);
    return () => window.clearTimeout(timer);
  }, [done]);
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('-mx-2 mt-2 flex gap-1', className)}>
        {actions.map((action) => {
          const ticked = done === action.key;
          return (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={ticked ? 'Copied' : action.label}
                  onClick={() => {
                    void Promise.resolve(action.run()).then(
                      () => action.ticks && setDone(action.key),
                    );
                  }}
                  className="text-ink-2 hover:text-ink"
                >
                  {ticked ? <DoneIcon /> : action.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{ticked ? 'Copied' : action.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/**
 * The icons under an answer, as chat products have: copy the answer as
 * written (Markdown), copy a link to this session, and, under the latest
 * answer, Regenerate. Regenerate asks the same question again as a new turn:
 * the trace keeps every turn, so the earlier answer stays above it.
 */
export function ReplyActions({
  text,
  onRetry,
}: {
  text: string;
  onRetry?: () => void;
}): JSX.Element {
  const copy = (value: string): Promise<void> =>
    navigator.clipboard?.writeText(value) ?? Promise.resolve();
  return (
    <TurnActions
      actions={[
        { key: 'copy', label: 'Copy', icon: <CopyIcon />, run: () => copy(text), ticks: true },
        {
          key: 'link',
          label: 'Copy link',
          icon: <LinkIcon />,
          run: () => copy(window.location.href),
          ticks: true,
        },
        ...(onRetry
          ? [{ key: 'retry', label: 'Regenerate', icon: <RetryIcon />, run: onRetry }]
          : []),
      ]}
    />
  );
}

/** How many sources a search shows before "N more". */
const SOURCES_SHOWN = 4;

/** A search's results as links: what was searched, then each result to open. */
export function SearchSources({
  query,
  rows,
  receipt,
}: {
  query: string;
  rows: readonly StepRow[];
  receipt?: string | undefined;
}): JSX.Element {
  const [all, setAll] = useState(false);
  const found = rows.filter((row) => !row.empty);
  const source = rows[0]?.source ?? 'search';
  const shown = all ? found : found.slice(0, SOURCES_SHOWN);
  return (
    <section data-step="tool" data-tool="search">
      <p className="text-sm text-ink-2">
        Searched {source} for <span className="text-ink">{query}</span>
        {receipt ? <span className="ml-2 text-caption">{receipt}</span> : null}
      </p>
      {found.length === 0 ? (
        <p className="mt-1 text-sm text-ink">Nothing found.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {shown.map((row, index) => {
            const [id, ...rest] = row.text.split(', ');
            return (
              <li key={index} className="max-w-full">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  title={row.text}
                  className="flex max-w-[28rem] items-baseline gap-2 border border-rule-minor bg-well px-2 py-1 text-xs hover:border-ink"
                >
                  <span className="shrink-0 font-mono text-ink">{id}</span>
                  <span className="truncate text-ink-2">{rest.join(', ')}</span>
                </a>
              </li>
            );
          })}
          {found.length > SOURCES_SHOWN ? (
            <li>
              <button
                type="button"
                onClick={() => setAll(!all)}
                className="border border-rule-minor px-2 py-1 text-xs text-ink-2 hover:border-ink hover:text-ink"
              >
                {all ? 'Fewer' : `${found.length - SOURCES_SHOWN} more`}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
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
          <div className={cn(PROSE, 'text-sm break-words text-ink-2')}>
            <ReplyText text={step.text} />
          </div>
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
      // A literature search with links is drawn as its sources, the way chat
      // products show what they read: one line saying what was searched, and
      // the results as links. As a table, nothing could be opened.
      if (detail?.rows?.some((row) => row.url)) {
        return (
          <SearchSources
            query={step.text.replace(/^search\s+\w+:\s*/u, '')}
            rows={detail.rows}
            receipt={receipt === 'tool call' ? undefined : receipt}
          />
        );
      }
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
                  {/* A lead writes a reader's whole brief into its title; three
                      lines say which task it is, and the reader opens in full. */}
                  <span className="line-clamp-3 min-w-0 break-words text-ink decoration-[1.5px] underline-offset-[0.15em] group-hover:underline">
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

/** A session's state in the list, in the words the bar uses. */
const SESSION_WORD: Record<Task['status'], string> = {
  queued: 'Queued',
  running: 'Running',
  waiting: 'Waiting on you',
  ended: 'Finished',
  stopped: 'Stopped',
  failed: 'Failed',
};

/** One of a project's sessions, as the sessions route lists it. */
export interface ProjectSession {
  readonly id: string;
  readonly title: string;
  readonly status: Task['status'];
  readonly startedAt: number;
}

/**
 * The project's sessions, newest first, and New session. A project holds
 * more than one: each starts from its own question, and the kept files are
 * the project's, so a later session works on what an earlier one saved.
 * Without this list a reply only ever continued the one session.
 */
export function Sessions({
  sessions,
  current,
  starting,
  onNew,
}: {
  sessions: readonly ProjectSession[];
  current: string;
  /** The field is set to start a new session. */
  starting: boolean;
  onNew: () => void;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <ul>
        {[...sessions]
          .sort((a, b) => b.startedAt - a.startedAt)
          .map((item) => (
            <li key={item.id} className="border-t border-rule-minor first:border-t-0">
              {/* A row like the call tree's: the whole row opens the session,
                  and the one open is filled and bold. As plain text the list
                  did not read as a way to move between sessions. */}
              <a
                href={`?session=${encodeURIComponent(item.id)}#/session`}
                aria-current={item.id === current ? 'page' : undefined}
                title={item.title}
                className={cn(
                  'flex min-h-8 items-center justify-between gap-4 px-2 py-1 text-sm text-ink',
                  WELL_ROW,
                  // A link marks the open page as "page", not "true".
                  'aria-[current=page]:border-ink aria-[current=page]:bg-raised',
                )}
              >
                <span
                  className={cn('truncate', item.id === current ? 'font-semibold' : 'font-normal')}
                >
                  {item.title}
                </span>
                <span className="shrink-0 text-caption">{SESSION_WORD[item.status]}</span>
              </a>
            </li>
          ))}
      </ul>
      <Button variant="outline" size="sm" aria-pressed={starting} onClick={onNew}>
        {starting ? 'Cancel new session' : 'New session'}
      </Button>
    </div>
  );
}

/** A file or folder the project has written, as the files route lists it. */
export interface ProjectFile {
  readonly name: string;
  readonly virtualPath: string;
  readonly kind: 'file' | 'directory';
  readonly modifiedAt: number;
}

/**
 * LI ZHUOYANG's. The project's files, in three groups: what the person
 * attached (/mnt/upload), the kept results (/mnt/output), and this session's
 * scratch (/mnt/workspace), each newest first. Readers write to the scratch
 * by default, and the lead then called a file saved that the panel did not
 * show. An attachment was listed nowhere at all, so the person could not see
 * that it had arrived. A file opens in a new tab from steering's files route.
 * A folder opens in place: an agent that saved its tables to results/ left
 * them out of reach behind a name that did nothing.
 */
export function Files({
  files,
  projectId,
  sessionId,
  openFolder,
}: {
  files: readonly ProjectFile[] | 'failed';
  projectId?: string | undefined;
  sessionId?: string | undefined;
  /** What a folder holds; without it a folder is only named. */
  openFolder?: ((virtualPath: string) => Promise<readonly ProjectFile[]>) | undefined;
}): JSX.Element {
  if (files === 'failed') {
    return <p className="text-sm text-ink-2">The files could not be read.</p>;
  }
  if (files.length === 0) return <p className="text-sm text-ink-2">None yet.</p>;
  const under = (root: string): ProjectFile[] =>
    files.filter((file) => file.virtualPath.startsWith(`/mnt/${root}/`));
  const groups = [
    { label: 'Attached', files: under('upload') },
    { label: 'Kept', files: under('output') },
    { label: 'Scratch, this session only', files: under('workspace') },
  ].filter((group) => group.files.length > 0);
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-xs text-ink-2">{group.label}</p>
          <FileList
            files={group.files}
            projectId={projectId}
            sessionId={sessionId}
            openFolder={openFolder}
          />
        </div>
      ))}
    </div>
  );
}

function FileList({
  files,
  projectId,
  sessionId,
  openFolder,
}: {
  files: readonly ProjectFile[];
  projectId: string | undefined;
  sessionId: string | undefined;
  openFolder: ((virtualPath: string) => Promise<readonly ProjectFile[]>) | undefined;
}): JSX.Element {
  return (
    <ul>
      {[...files]
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .map((file) => (
          <li
            key={file.virtualPath}
            className="border-t border-rule-minor py-1 font-mono text-xs break-all text-ink first:border-t-0"
          >
            {file.kind === 'directory' ? (
              <Folder
                file={file}
                projectId={projectId}
                sessionId={sessionId}
                openFolder={openFolder}
              />
            ) : (
              <FileLink file={file} projectId={projectId} sessionId={sessionId} />
            )}
          </li>
        ))}
    </ul>
  );
}

function FileLink({
  file,
  projectId,
  sessionId,
}: {
  file: ProjectFile;
  projectId: string | undefined;
  sessionId: string | undefined;
}): JSX.Element {
  if (!projectId) return <span>{file.name}</span>;
  const path = file.virtualPath.replace(/^\/mnt\//, '');
  const session =
    path.startsWith('workspace/') && sessionId ? `?session=${encodeURIComponent(sessionId)}` : '';
  return (
    <a
      href={`/api/projects/${encodeURIComponent(projectId)}/files/${path}${session}`}
      target="_blank"
      rel="noreferrer"
      className="hover:underline"
    >
      {file.name}
    </a>
  );
}

function Folder({
  file,
  projectId,
  sessionId,
  openFolder,
}: {
  file: ProjectFile;
  projectId: string | undefined;
  sessionId: string | undefined;
  openFolder: ((virtualPath: string) => Promise<readonly ProjectFile[]>) | undefined;
}): JSX.Element {
  const [inside, setInside] = useState<readonly ProjectFile[] | 'failed' | null>(null);
  const [open, setOpen] = useState(false);
  if (!openFolder) return <span>{file.name}/</span>;
  const toggle = (): void => {
    setOpen(!open);
    if (open || inside) return;
    openFolder(file.virtualPath).then(setInside, () => setInside('failed'));
  };
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="text-left hover:underline"
      >
        {file.name}/
      </button>
      {open ? (
        <div className="mt-1 border-l border-rule-minor pl-3">
          {inside === null ? (
            <p className="text-ink-2">Reading…</p>
          ) : inside === 'failed' ? (
            <p className="text-ink-2">This folder could not be read.</p>
          ) : inside.length === 0 ? (
            <p className="text-ink-2">Empty.</p>
          ) : (
            <FileList
              files={inside}
              projectId={projectId}
              sessionId={sessionId}
              openFolder={openFolder}
            />
          )}
        </div>
      ) : null}
    </>
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

/**
 * LI ZHUOYANG's. The one field at the foot of the conversation (ui/composer):
 * it says a new turn to the lead, or, while a run is going, steers the task
 * shown at its next step. Stop is in the bar.
 *
 * A steer always lands at the next step. The field had a switch for "at the
 * end of its turn" as well, and people could not tell what the switch was;
 * the server still takes both.
 */
export function Composer({
  disabled,
  running,
  steerable,
  onSay,
  onSteer,
  shownAgent = null,
  onAttach,
  prefill,
  newSession = false,
  toolbar,
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
   * "reader 2". A steer goes to it, so the timing switch names it. A new
   * turn always goes to the lead, and the field says "Reply to lumen".
   */
  shownAgent?: string | null;
  /**
   * Saves a file to the project's /mnt/upload and resolves with its path.
   * The next message says where it is, so lumen reads it; without that, an
   * attachment would sit in a folder nobody was told about.
   */
  onAttach?: ((file: File) => Promise<string>) | undefined;
  /** Text put in the field from outside (Edit on a message); `key` changes each time. */
  prefill?: { readonly text: string; readonly key: number } | undefined;
  /** The field starts a new session in this project instead of replying. */
  newSession?: boolean;
  /** More controls at the foot of the field (the model for a new session). */
  toolbar?: ReactNode;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  // A new prefill replaces the draft during render, not in an effect, so
  // the field never paints the old text first.
  const [filled, setFilled] = useState<number | null>(null);
  if (prefill && prefill.key !== filled) {
    setFilled(prefill.key);
    setDraft(prefill.text);
  }
  useEffect(() => {
    if (!prefill) return;
    const field = document.querySelector<HTMLTextAreaElement>('textarea[name="say"]');
    field?.focus();
    field?.setSelectionRange(prefill.text.length, prefill.text.length);
  }, [prefill]);
  const [attached, setAttached] = useState<readonly string[]>([]);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  // Blocked for a reason a run.status can change without a fresh render of
  // this form's own props, so this is computed at submit time, not baked into
  // one boolean passed in.
  // A new session does not wait on this one: it can start while this runs.
  const blocked = disabled || (!newSession && running && !steerable);
  function submit(): void {
    // Enter submits too. Nothing is sent, and the text is kept, while the
    // socket is down, or the root is busy with a task that is not the one
    // shown (there is nothing here to steer).
    const typed = turnToSend(draft || (attached.length ? 'Read what I attached.' : ''), blocked);
    if (typed === null) return;
    const text = attached.length ? `${typed}\n\nAttached: ${attached.join(', ')}` : typed;
    if (running && !newSession) onSteer(text, 'next-step');
    else onSay(text);
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
  // Status only: an upload, a failed upload, a connection that is down.
  // Lines that explained the field ("Ended. A reply starts a new turn.",
  // "Read at its next step.") said what the field and its switch already show.
  const hint = attachNote ?? (disabled ? 'Reconnecting…' : '');
  return (
    <Field
      name="say"
      label={newSession ? 'New session' : running ? 'Steer the task shown' : 'Reply to lumen'}
      placeholder={
        newSession
          ? 'Start a new session in this project…'
          : running
            ? steerable
              ? `Steer ${shownAgent ?? 'lumen'}…`
              : // Not running: finished, stopped, or waiting for an approval.
                'Nothing to steer right now'
            : 'Reply to lumen…'
      }
      value={draft}
      onValueChange={setDraft}
      onSubmit={submit}
      // The text stays typeable while the socket is down, so a steer can be
      // drafted for when it is back.
      // Only a task that is not running has nothing to steer at all.
      disabled={!newSession && running && !steerable}
      sendDisabled={blocked}
      sendLabel={newSession ? 'Start the session' : running ? 'Steer' : 'Send'}
      hint={hint}
      {...(onAttach ? { onAttach: attach } : {})}
      toolbar={toolbar}
      attachments={attached.map((path) => path.replace(/^\/mnt\/upload\//, ''))}
      onRemoveAttachment={(name) =>
        setAttached((list) => list.filter((path) => !path.endsWith(`/${name}`)))
      }
    />
  );
}
