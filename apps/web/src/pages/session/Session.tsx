// Owners: LIU ZIYANG (call tree, steps) and LI ZHUOYANG (composer, files).
// The two halves below are the agreed boundary between them: each owner works
// inside their own panel and neither restyles the other.
import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { ServerEvent, Task } from '@lumen/contracts';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { PageHeader } from '@/core/shell';
import {
  apply,
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
  // The socket is an external system, not render state: a ref, so opening it
  // does not itself schedule a render.
  const stream = useRef<Stream | null>(null);

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
                <ul className="space-y-3">
                  {snapshot.tasks.map((task) => (
                    <li key={task.id} className="rounded-md bg-sunken p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ink">
                          <span className="font-mono text-muted-foreground">{task.agent}</span>{' '}
                          {task.title}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {money(task.ownCost.dollars)}
                          </span>
                          <Badge className={TONE[task.status]}>{task.status}</Badge>
                        </span>
                      </div>
                      <ol className="mt-2 space-y-1">
                        {snapshot.steps
                          .filter((step) => step.taskId === task.id)
                          .map((step) => (
                            <li key={step.index} className="text-sm text-muted-foreground">
                              <span className="font-mono text-faint">{step.index}</span> {step.text}
                            </li>
                          ))}
                      </ol>
                    </li>
                  ))}
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
