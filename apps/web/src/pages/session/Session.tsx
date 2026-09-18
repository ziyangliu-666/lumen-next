// Owners: LIU ZIYANG (call tree, steps) and LI ZHUOYANG (composer, files).
// The two halves below are the agreed boundary between them: each owner works
// inside their own panel and neither restyles the other.
import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { ServerEvent, StepKind, Task } from '@lumen/contracts';
import { cn } from 'cn';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { PageHeader } from '@/core/shell';
import {
  apply,
  fetchSession,
  inTreeOrder,
  openStream,
  signInStub,
  startSession,
  stubAccount,
  type SessionState,
  type Stream,
} from '@/core/api';

// One tint per task status, from the theme, so a status means the same colour
// here as on the project card.
const TONE: Record<Task['status'], string> = {
  queued: 'bg-sunken text-muted-foreground',
  running: 'bg-accent text-accent-foreground',
  waiting: 'bg-decide-soft text-decide',
  ended: 'bg-keep-soft text-keep',
  stopped: 'bg-gap-soft text-gap',
  failed: 'bg-gap-soft text-gap',
};

// How far a task sits from the left, by depth. Written out, because Tailwind
// only ships the classes it can read in the source.
const INDENT = ['ml-0', 'ml-6', 'ml-12', 'ml-16'] as const;

const KIND_TONE: Record<StepKind, string> = {
  you: 'text-primary',
  thinking: 'text-faint',
  tool: 'text-decide',
  delegate: 'text-chart-2',
  reply: 'text-keep',
};

function money(dollars: number): string {
  return `$${dollars.toFixed(4)}`;
}

/** A text field's value, trimmed. A file field or a missing one is empty. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function Session(): JSX.Element {
  const [account, setAccount] = useState<string>(() => stubAccount() ?? '');
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The socket is an external system, not render state: a ref, so opening it
  // does not itself schedule a render.
  const stream = useRef<Stream | null>(null);

  // Another page hands a session over as `?session=<id>&task=<id>` in front of
  // the hash: Landing after it creates a project, Home from a card or a finding.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const id = query.get('session');
    if (!id) return;
    let active = true;
    fetchSession(id).then(
      (snapshot) => {
        if (!active) return;
        setState({ snapshot, stream: 'connecting' });
        const taskId = query.get('task');
        if (taskId && snapshot.tasks.some((task) => task.id === taskId)) setSelected(taskId);
      },
      (failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not open it.');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // One socket per open session; closed when the session changes or the page goes.
  useEffect(() => {
    const sessionId = state?.snapshot.session.id;
    if (!sessionId) return;
    const onEvent = (event: ServerEvent): void =>
      setState((current) => (current ? apply(current, event) : current));
    const onState = (life: SessionState['stream']): void =>
      setState((current) => (current ? { ...current, stream: life } : current));
    const opened = openStream(sessionId, onEvent, onState);
    stream.current = opened;
    return () => {
      opened.close();
      stream.current = null;
    };
  }, [state?.snapshot.session.id]);

  async function onStart(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const who = field(form, 'account');
    const projectId = field(form, 'project');
    const text = field(form, 'text');
    if (!who || !projectId || !text) return;
    signInStub(who);
    setAccount(who);
    setError(null);
    try {
      const snapshot = await startSession(projectId, text);
      setState({ snapshot, stream: 'connecting' });
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'could not start');
    }
  }

  function onSay(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const text = field(new FormData(form), 'say');
    if (!text || !state || !stream.current) return;
    stream.current.send({ type: 'session.say', sessionId: state.snapshot.session.id, text });
    form.reset();
  }

  const snapshot = state?.snapshot;
  const description = snapshot
    ? `Project ${snapshot.session.projectId} · signed in as ${account} · stream ${state.stream}`
    : 'One question, and every agent it reached.';

  return (
    <>
      <PageHeader title="Session" description={description} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* LIU ZIYANG: the call tree and the step list. */}
        <Card className="min-h-96">
          <CardHeader>
            <CardTitle className="text-base">Call tree</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {snapshot.tasks.length} task{snapshot.tasks.length === 1 ? '' : 's'} · session
                  spend <span className="font-mono text-ink">{money(snapshot.spend.dollars)}</span>
                </p>
                <ul className="space-y-2">
                  {inTreeOrder(snapshot.tasks).map((task) => {
                    const open = (selected ?? snapshot.tasks[0]?.id) === task.id;
                    const total = snapshot.totals[task.id]?.dollars ?? 0;
                    return (
                      <li
                        key={task.id}
                        className={cn(
                          'rounded-md bg-sunken',
                          INDENT[Math.min(task.depth, INDENT.length - 1)],
                        )}
                      >
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setSelected(task.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-md p-3 text-left hover:bg-accent"
                        >
                          <span className="text-sm text-ink">
                            <span className="font-mono text-muted-foreground">{task.agent}</span>{' '}
                            {task.title}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span
                              className="font-mono text-xs text-muted-foreground"
                              title="own cost / with everything delegated under it"
                            >
                              {money(task.ownCost.dollars)} / {money(total)}
                            </span>
                            <Badge className={TONE[task.status]}>{task.status}</Badge>
                          </span>
                        </button>
                        {open ? (
                          <ol className="space-y-1 px-3 pb-3">
                            {snapshot.steps
                              .filter((step) => step.taskId === task.id)
                              .map((step) => (
                                <li key={step.index} className="text-sm text-muted-foreground">
                                  <span className={cn('font-mono text-xs', KIND_TONE[step.kind])}>
                                    {step.kind}
                                  </span>{' '}
                                  {step.text}
                                </li>
                              ))}
                          </ol>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <form onSubmit={onSay} className="flex gap-2">
                  <Input name="say" placeholder="Say something to the lead…" />
                  <Button type="submit" variant="outline" disabled={state.stream !== 'open'}>
                    Say
                  </Button>
                </form>
              </>
            ) : (
              <form onSubmit={(event) => void onStart(event)} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="account">Account (Sprint 1 stub)</Label>
                  <Input id="account" name="account" defaultValue={account} placeholder="demo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project">Project</Label>
                  <Input id="project" name="project" defaultValue="demo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text">Question</Label>
                  <Textarea
                    id="text"
                    name="text"
                    rows={3}
                    placeholder="What do you want to know?"
                  />
                </div>
                {error ? <p className="text-sm text-gap">{error}</p> : null}
                <Button type="submit">Start the session</Button>
              </form>
            )}
          </CardContent>
        </Card>
        {/* LI ZHUOYANG: the composer and the files panel. */}
        <Card className="min-h-96">
          <CardHeader>
            <CardTitle className="text-base">Steer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Say something to the run…" rows={4} />
            <Button className="w-full">Queue for the next step</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
