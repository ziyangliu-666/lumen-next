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
import {
  CallTree,
  Composer,
  Findings,
  money,
  StatusWord,
  StepStream,
  WaitingNotice,
} from './parts';
import { atFoot, elapsed } from './tree';

interface ProjectTitle {
  readonly title: string;
}

/** The small capitals over a panel. */
function PanelTitle({ children, count }: { children: string; count?: number }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between px-2 pb-2">
      <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        {children}
      </h2>
      {count === undefined ? null : (
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      )}
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
  // The stream scrolls inside its card, with the composer pinned under it.
  const streamBox = useRef<HTMLDivElement | null>(null);
  // Whether the reader was at the foot of the stream before the newest step
  // came. It is written on scroll, not measured after the step is laid out: a
  // tall step would then count as "the reader scrolled up" and end the follow.
  const following = useRef(true);

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
  // Both are the projects slice's, so both are read from it. They are read
  // again each time the stream opens: a snapshot carries no findings, so after
  // a dropped connection this is what brings back the ones recorded while
  // nobody was listening. In between, `finding.recorded` keeps the list
  // current. A failure here costs the title and the list, never the page.
  const sessionId = state?.snapshot.session.id;
  const projectId = state?.snapshot.session.projectId;
  const connected = state?.stream === 'open';
  useEffect(() => {
    if (!sessionId || !projectId || !connected) return;
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
  }, [sessionId, projectId, connected]);

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
    // Once at once, then every second: a run that starts again (a second turn)
    // must not show the clock the first one stopped at.
    const tick = (): void => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [running]);

  // Keep the newest step in view while the reader is at the foot of the stream;
  // leave them alone when they have scrolled up to read. Only the steps of the
  // task that is shown count.
  const shownId = selected ?? root?.id;
  const shownSteps = snapshot?.steps.filter((step) => step.taskId === shownId).length ?? 0;
  useEffect(() => {
    const box = streamBox.current;
    if (box && following.current) box.scrollTop = box.scrollHeight;
  }, [shownSteps]);

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
  const thisSession = snapshot.session.id;
  const rootId = root.id;
  const took = elapsed((root.endedAt ?? now) - root.startedAt);

  // Opening another task replaces the stream, and with it the button that had
  // the focus. Give the focus to the stream, not to nothing, and start at its
  // head. Opening the task that is already shown changes nothing.
  function open(taskId: string): void {
    if (taskId === shown.id) return;
    setSelected(taskId);
    following.current = false;
    window.requestAnimationFrame(() => {
      if (!streamBox.current) return;
      streamBox.current.scrollTop = 0;
      streamBox.current.focus();
    });
  }

  // A new turn is the lead's. Show it arrive: the lead's stream, at its foot,
  // following. The focus stays in the input, for the turn after this one.
  function say(text: string): void {
    stream.current?.send({ type: 'session.say', sessionId: thisSession, text });
    setSelected(rootId);
    following.current = true;
    window.requestAnimationFrame(() => {
      if (streamBox.current) streamBox.current.scrollTop = streamBox.current.scrollHeight;
    });
  }

  // Steers the task the stream shows, not necessarily the root: a person
  // reading a reader's own stream steers that reader, not the lead. Lands at
  // the worker's next step, the soonest moment a steer can reach it.
  function steer(text: string): void {
    stream.current?.send({ type: 'task.steer', taskId: shown.id, text, when: 'next-step' });
  }

  return (
    <div className="space-y-3">
      {/* One line beside the stream: the card's height counts on it. A long
          question is cut here and whole in the first block of the stream. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 lg:flex-nowrap">
        <h1
          className="min-w-0 text-base break-words text-ink lg:truncate"
          title={project?.title ?? root.title}
        >
          <span className="font-semibold">{project?.title ?? root.title}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-muted-foreground">
            {snapshot.session.mode === 'seed' ? 'a starting point' : 'free exploration'}
          </span>
          {/* Which task the stream shows, when it is not the lead's. */}
          {shown.id === root.id ? null : (
            <span className="font-mono text-sm text-primary"> / {shown.agent}</span>
          )}
        </h1>
        <p className="flex shrink-0 items-baseline gap-3 font-mono text-sm text-muted-foreground">
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* LIU ZIYANG: the steps of the selected task. LI ZHUOYANG: the composer at its foot. */}
        <Card className="flex h-[calc(100dvh-11rem)] min-h-96 min-w-0 flex-col gap-0 overflow-hidden py-0">
          <div
            ref={streamBox}
            tabIndex={-1}
            onScroll={(event) => {
              following.current = atFoot(event.currentTarget);
            }}
            aria-label={`Steps of ${shown.agent}`}
            className="flex-1 overflow-y-auto focus:outline-none"
          >
            <StepStream
              task={shown}
              steps={snapshot.steps.filter((step) => step.taskId === shown.id)}
              tasks={snapshot.tasks}
              onSelect={open}
            />
          </div>
          <WaitingNotice task={shown} />
          <Composer
            disabled={state.stream !== 'open' || auth.status !== 'ready'}
            running={running}
            steerable={shown.status === 'running'}
            onSay={say}
            onSteer={steer}
            onStop={() =>
              stream.current?.send({ type: 'session.stop', sessionId: snapshot.session.id })
            }
          />
        </Card>

        {/* One panel, divided by rules, as the spec draws the rail. Beside the
            stream it is no taller than the stream and scrolls inside itself, so
            a long list of findings does not grow the page. */}
        <Card className="min-w-0 gap-0 divide-y divide-border self-start p-0 lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto">
          <section className="p-2 pt-3">
            <PanelTitle>call tree</PanelTitle>
            <CallTree
              tasks={snapshot.tasks}
              totals={snapshot.totals}
              selected={shown.id}
              onSelect={open}
            />
          </section>
          <section className="p-2 pt-3">
            <PanelTitle count={state.findings.length}>findings</PanelTitle>
            <Findings findings={state.findings} tasks={snapshot.tasks} onSelect={open} />
          </section>
        </Card>
      </div>
    </div>
  );
}
