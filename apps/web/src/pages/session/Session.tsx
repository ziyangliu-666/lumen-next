// Page 04, Session. Owners: LIU ZIYANG (the step stream, the call tree) and
// LI ZHUOYANG (the composer, the files panel). Layout after docs/spec, 04: what
// the agent thought and did is the main column; the call tree and the findings
// are the narrow column beside it; the composer is the foot of the stream.
import { useEffect, useRef, useState, type JSX } from 'react';
import type { ServerEvent } from '@lumen/contracts';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { useCurrentAccount } from '@/core/auth';
import {
  apply,
  fetchSession,
  openStream,
  request,
  type SessionFinding,
  type SessionState,
  type Stream,
} from '@/core/api';
import { CallTree, Composer, Findings, money, StatusWord, StepStream } from './parts';
import { elapsed } from './tree';

interface ProjectTitle {
  readonly title: string;
}

/** The small capitals over a panel. */
function PanelTitle({ children, count }: { children: string; count?: number }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between px-2 pb-2">
      <h2 className="font-mono text-xs tracking-widest text-faint uppercase">{children}</h2>
      {count === undefined ? null : <span className="font-mono text-xs text-faint">{count}</span>}
    </div>
  );
}

export function Session(): JSX.Element {
  const { state: auth } = useCurrentAccount();
  const [state, setState] = useState<SessionState | null>(null);
  const [project, setProject] = useState<ProjectTitle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The clock in the header, for a session that is still running.
  const [now, setNow] = useState(() => Date.now());
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
        setState({ snapshot, findings: [], stream: 'connecting' });
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

  // The project's title for the header, and what the session has kept so far.
  // Both are the projects slice's, so both are read from it, once; after that
  // `finding.recorded` keeps the list current. A failure here costs the title
  // and the list, never the page.
  const sessionId = state?.snapshot.session.id;
  const projectId = state?.snapshot.session.projectId;
  useEffect(() => {
    if (!sessionId || !projectId) return;
    let active = true;
    const base = `/api/projects/${encodeURIComponent(projectId)}`;
    request<{ item: { project: ProjectTitle } }>(base).then(
      (reply) => active && setProject(reply.item.project),
      () => undefined,
    );
    request<{ items: (SessionFinding & { sessionId: string })[] }>(`${base}/findings`).then(
      (reply) => {
        if (!active) return;
        const mine = reply.items
          .filter((finding) => finding.sessionId === sessionId)
          .map(({ id, taskId, text }) => ({ id, taskId, text }))
          .reverse();
        setState((current) => {
          if (!current) return current;
          const known = new Set(mine.map((finding) => finding.id));
          const later = current.findings.filter((finding) => !known.has(finding.id));
          return { ...current, findings: [...mine, ...later] };
        });
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [sessionId, projectId]);

  // One socket per open session; closed when the session changes or the page goes.
  useEffect(() => {
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
  }, [sessionId]);

  const snapshot = state?.snapshot;
  const root = snapshot?.tasks.find((task) => task.parentId === null);
  const running = root !== undefined && root.endedAt === null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!state || !snapshot || !root) {
    return (
      <Card className="mx-auto mt-12 max-w-xl space-y-3 p-6 text-sm text-muted-foreground">
        {error ? <p className="text-gap">{error}</p> : null}
        <p>
          A session belongs to a project. Start one from a question, or open one from your projects,
          and what the agents think and do draws here.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="#/">Ask a question</a>
          </Button>
          <Button asChild variant="outline">
            <a href="#/home">Your projects</a>
          </Button>
        </div>
      </Card>
    );
  }

  const shown = snapshot.tasks.find((task) => task.id === selected) ?? root;
  const took = elapsed((root.endedAt ?? now) - root.startedAt);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="min-w-0 text-base text-ink">
          <span className="font-semibold">{project?.title ?? root.title}</span>
          <span className="text-faint"> / </span>
          <span className="text-muted-foreground">
            {snapshot.session.mode === 'seed' ? 'a starting point' : 'free exploration'}
          </span>
        </h1>
        <p className="flex items-baseline gap-3 font-mono text-sm text-muted-foreground">
          <span>
            {money(snapshot.spend.dollars)} · {took}
          </span>
          <StatusWord status={root.status} />
          {state.stream === 'open' ? null : (
            <span className="text-decide" title="The live stream is not connected">
              {state.stream === 'connecting' ? 'connecting…' : 'offline, retrying'}
            </span>
          )}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* LIU ZIYANG: the steps of the selected task. LI ZHUOYANG: the composer at its foot. */}
        <Card className="flex min-h-96 flex-col gap-0 overflow-hidden py-0">
          <div className="flex-1">
            <StepStream
              task={shown}
              steps={snapshot.steps.filter((step) => step.taskId === shown.id)}
              tasks={snapshot.tasks}
              onSelect={setSelected}
            />
          </div>
          <Composer
            disabled={state.stream !== 'open' || auth.status !== 'ready'}
            onSay={(text) => {
              stream.current?.send({ type: 'session.say', sessionId: snapshot.session.id, text });
              // A new turn is the lead's; show it arrive.
              setSelected(root.id);
            }}
          />
        </Card>

        <aside className="space-y-3">
          <Card className="gap-0 p-2 pt-3">
            <PanelTitle>call tree</PanelTitle>
            <CallTree
              tasks={snapshot.tasks}
              totals={snapshot.totals}
              selected={shown.id}
              onSelect={setSelected}
            />
          </Card>
          <Card className="gap-0 p-2 pt-3">
            <PanelTitle count={state.findings.length}>findings</PanelTitle>
            <Findings findings={state.findings} tasks={snapshot.tasks} onSelect={setSelected} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
