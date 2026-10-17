// Page 04, Session. Owners: LIU ZIYANG (the step stream, the call tree) and
// LI ZHUOYANG (the composer, the files panel). Layout after docs/spec, 04, in
// the Raster look: two surfaces. On
// paper, the conversation, with the composer at its foot. On the well, what
// the project has produced: findings, the call tree, files. The bar carries
// where you are and how the run stands, so the page has one header.
import { useCallback, useEffect, useId, useRef, useState, type JSX, type ReactNode } from 'react';
import type { ServerEvent } from '@lumen/contracts';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { ScrollRegion } from '@/ui/scroll-region';
import { SurfaceMain, Surfaces, SurfaceWell } from '@/ui/surfaces';
import { rememberReturn, useCurrentAccount } from '@/core/auth';
import { ModelPicker, useModels } from '@/core/models';
import { go } from '@/core/router';
import { BarActions, BarCrumb, BarStatus } from '@/core/shell';
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
  Files,
  Findings,
  money,
  type ProjectFile,
  type ProjectSession,
  Sessions,
  StepStream,
  type SteerWhen,
  StopControl,
  TaskState,
  WaitingNotice,
} from './parts';
import { ReplyFiles } from './text';
import { atFoot, elapsed, speakerNames } from './tree';

interface ProjectTitle {
  readonly title: string;
}

/**
 * One section of the panel: a header that folds it, with its count and an
 * action, then what it holds. An empty section is one folded line ("Files
 * 0") instead of a heading over "None yet.". The four were large headings
 * over similar rows, and the panel read as one long list.
 */
function WellSection({
  id,
  name,
  count,
  action,
  children,
}: {
  id: string;
  name: string;
  count?: number | undefined;
  action?: ReactNode;
  children: JSX.Element;
}): JSX.Element {
  const [shown, setShown] = useState<boolean | null>(null);
  const open = shown ?? count !== 0;
  return (
    <section
      aria-labelledby={id}
      className="border-t border-rule-minor py-3 first-of-type:border-t-0"
    >
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold text-ink">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setShown(!open)}
            className="flex items-center gap-2 hover:text-ink"
          >
            <span
              aria-hidden="true"
              className={cn('inline-block text-ink-2 transition-transform', open && 'rotate-90')}
            >
              ›
            </span>
            {name}
            {count === undefined ? null : (
              <span className="font-normal text-ink-2 tabular-nums">{count}</span>
            )}
          </button>
        </h2>
        {action}
      </div>
      {open ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}

/** Puts a file in the project's /mnt/upload (steering's upload route) and resolves with its path. */
async function upload(projectId: string, file: File): Promise<string> {
  const saved = await request<{ path: string }>(
    `/api/projects/${encodeURIComponent(projectId)}/upload/${encodeURIComponent(file.name)}`,
    { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: file },
  );
  return saved.path;
}

/** Steering's files route for one project. */
function filesRoute(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/files`;
}

/**
 * The query that lists one folder: '/mnt/output/results' is scope=output and
 * path=/results. A folder in the scratch also names the session.
 */
function scopeQuery(virtualPath: string, sessionId: string | undefined): string {
  const [, scope = '', ...rest] = virtualPath.replace(/^\/mnt\//, '/').split('/');
  const query = new URLSearchParams({ scope });
  if (rest.length > 0) query.set('path', `/${rest.join('/')}`);
  if (scope === 'workspace' && sessionId) query.set('session', sessionId);
  return query.toString();
}

export function Session(): JSX.Element {
  const { state: auth } = useCurrentAccount();
  const [state, setState] = useState<SessionState | null>(null);
  const [project, setProject] = useState<ProjectTitle | null>(null);
  const [files, setFiles] = useState<readonly ProjectFile[] | 'failed'>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; key: number } | undefined>(undefined);
  // The project's sessions, and whether the field starts a new one.
  const [sessions, setSessions] = useState<readonly ProjectSession[]>([]);
  const [starting, setStarting] = useState(false);
  const models = useModels(auth.status === 'ready');
  const [nextModel, setNextModel] = useState<string | undefined>(undefined);
  // The finding last chosen in the well. It stays marked while the
  // conversation shows the task that recorded it.
  const [chosenFinding, setChosenFinding] = useState<string | null>(null);
  // When this page saw the lead start its current turn. The task's own
  // startedAt is the session's first start, so after a reply the clock
  // counted the idle time between the turns ("Ran 59 s" for 5 s of work).
  const [turnStart, setTurnStart] = useState<number | null>(null);
  // Below 1080px the well is a sheet over the conversation, opened from the bar.
  const [sheet, setSheet] = useState(false);
  const sheetToggle = useRef<HTMLButtonElement | null>(null);
  const wellId = useId();
  // The clock in the bar, for a session that is still running.
  const [now, setNow] = useState(() => Date.now());
  // The socket is an external system, not render state: a ref, so opening it
  // does not itself schedule a render.
  const stream = useRef<Stream | null>(null);
  // The socket's last state, kept apart from the page state. The socket can
  // open before the snapshot request answers; that 'open' then found no state
  // to land in, the snapshot wrote 'connecting', and the page said Connecting
  // and refused to send for as long as it was open.
  const life = useRef<SessionState['stream']>('connecting');
  // The conversation scrolls inside its surface, with the composer pinned under it.
  const streamBox = useRef<HTMLElement | null>(null);
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
        setState({ snapshot, findings: [], stream: life.current });
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

  // The task shown is in the address, as `&task=<id>`, so Back returns to the
  // task shown before and a reload keeps the reader that was open. Before,
  // the address stayed the same and Back left the app.
  useEffect(() => {
    const onPop = (): void => setSelected(new URLSearchParams(window.location.search).get('task'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // The project's title for the bar, and what the session has kept so far.
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
    request<{ items: (SessionFinding & { sessionId: string; createdAt: number })[] }>(
      `${base}/findings`,
    ).then(
      (reply) => {
        if (!active) return;
        const mine = reply.items
          .filter((finding) => finding.sessionId === sessionId)
          .map(({ id, taskId, text, createdAt }) => ({ id, taskId, text, createdAt }))
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
    const onState = (next: SessionState['stream']): void => {
      life.current = next;
      setState((current) => (current ? { ...current, stream: next } : current));
    };
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
  // A run that ends while it is on screen has been seen. The visit was
  // marked when the project opened, before the run ended, so the projects
  // page then called its own end "new activity since your last visit".
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current || !projectId) return;
    wasRunning.current = false;
    request(`/api/projects/${encodeURIComponent(projectId)}/visit`, { method: 'POST' }).catch(
      () => undefined,
    );
  }, [running, projectId]);
  useEffect(() => {
    if (!running) return;
    // Once at once, then every second: a run that starts again (a second turn)
    // must not show the clock the first one stopped at.
    const tick = (): void => setNow(Date.now());
    // The turn starts now, as far as this page can tell.
    const first = window.setTimeout(() => {
      setTurnStart(Date.now());
      tick();
    }, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [running]);

  // The project's files (steering's files route). Read when the stream opens
  // and again when a run starts or ends: a run starts with what was just
  // attached and ends with its files complete. A failure costs this list, never the page.
  // The project's sessions, read with the files: when the stream opens and
  // when a run starts or ends. A failure leaves the list out, never the page.
  useEffect(() => {
    if (!projectId || !connected) return;
    let active = true;
    request<{ items: ProjectSession[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions`,
    ).then(
      (body) => active && setSessions(body.items),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [projectId, connected, running]);

  useEffect(() => {
    if (!projectId || !connected) return;
    let active = true;
    // The attachments, the kept results, then this session's scratch. Readers
    // save to the scratch by default; a file they called saved was invisible
    // without it. Only the kept list failing costs the panel.
    const optional = (path: string): Promise<ProjectFile[]> =>
      request<ProjectFile[]>(path).catch(() => [] as ProjectFile[]);
    Promise.all([
      optional(`${filesRoute(projectId)}?scope=upload`),
      request<ProjectFile[]>(`${filesRoute(projectId)}?scope=output`),
      sessionId
        ? optional(`${filesRoute(projectId)}?${scopeQuery('/mnt/workspace', sessionId)}`)
        : Promise.resolve([] as ProjectFile[]),
    ]).then(
      (groups) => active && setFiles(groups.flat()),
      () => active && setFiles('failed'),
    );
    return () => {
      active = false;
    };
  }, [projectId, connected, running]);

  // Keep the newest step in view while the reader is at the foot of the stream;
  // leave them alone when they have scrolled up to read. Only the steps of the
  // task that is shown count. The latest exchange is at least as tall as the
  // region (StepStream), so "the foot" is the start of the person's latest turn
  // when the exchange fits the screen, and the end of it when it does not:
  // that is also where the page opens.
  const shownId = selected ?? root?.id;
  const shownSteps = snapshot?.steps.filter((step) => step.taskId === shownId).length ?? 0;
  //
  // A session that has ended opens once at the start of the person's latest
  // turn instead, so the question is in view: on a phone the foot of a long
  // answer hid what was asked, and nothing new arrives to follow.
  const opened = useRef(false);
  useEffect(() => {
    const box = streamBox.current;
    if (!box) return;
    if (!opened.current && shownSteps > 0) {
      opened.current = true;
      const latest = box.querySelector<HTMLElement>('[data-latest]');
      if (!running && latest) {
        following.current = false;
        box.scrollTop = latest.offsetTop;
        return;
      }
    }
    if (following.current) box.scrollTop = box.scrollHeight;
  }, [shownSteps, running]);

  // Closing the sheet gives the focus back to the button that opened it, so a
  // keyboard user is where they were.
  const closeSheet = useCallback(() => {
    setSheet(false);
    if (sheetToggle.current?.offsetParent) sheetToggle.current.focus();
  }, []);

  if (!state || !snapshot || !root) {
    // Signed out, the server's own words ("sign in first") read as a
    // fragment; the page says what to do and offers the one way in.
    const signedOut = auth.status === 'signed-out';
    return (
      <div className="w-full max-w-xl space-y-4 px-margin pt-12">
        <h1 className="text-xl font-semibold text-ink">
          {signedOut
            ? 'Sign in to open this session'
            : error
              ? 'This session could not be opened'
              : 'Opening the session'}
        </h1>
        {!signedOut && error ? <p className="text-ink-2">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {signedOut ? (
            <Button asChild>
              <a href="#/signin" onClick={() => rememberReturn(window.location.href)}>
                Sign in
              </a>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <a href="#/home">Your projects</a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const shown = snapshot.tasks.find((task) => task.id === selected) ?? root;
  const thisSession = snapshot.session.id;
  const rootId = root.id;
  const title = project?.title ?? root.title;
  // With more than one session, the bar names both: the project, then this
  // session by its own question. It named only the project, so every session
  // of it looked the same.
  const several = sessions.length > 1 && Boolean(project?.title);
  const heading = several ? root.title : title;
  const names = speakerNames(snapshot.tasks);
  const lead = shown.id === root.id;
  const ready = state.stream === 'open' && auth.status === 'ready';
  const shownName = lead ? 'lumen' : (names.get(shown.id) ?? shown.agent);
  // The clock counts the current turn. A page opened on the first turn
  // can take the task's own start; on a later turn it counts from when this
  // page saw the turn begin, because the record has no time for a turn.
  const firstTurn = !snapshot.steps.some((step) => step.taskId === root.id && step.kind === 'you');
  const clock = running
    ? turnStart !== null && !firstTurn
      ? elapsed(now - turnStart)
      : firstTurn
        ? elapsed(now - root.startedAt)
        : null
    : null;
  const endedAt = root.endedAt;

  // Opening another task replaces the stream, and with it the button that had
  // the focus. Give the focus to the stream, not to nothing, and start at its
  // head. Opening the task that is already shown changes nothing, except that
  // the sheet, if it is open, gets out of the way.
  function open(taskId: string): void {
    setSheet(false);
    if (taskId === shown.id) return;
    setSelected(taskId);
    const query = new URLSearchParams(window.location.search);
    if (taskId === rootId) query.delete('task');
    else query.set('task', taskId);
    window.history.pushState(null, '', `?${query.toString()}${window.location.hash}`);
    following.current = false;
    window.requestAnimationFrame(() => {
      if (!streamBox.current) return;
      streamBox.current.scrollTop = 0;
      streamBox.current.focus();
    });
  }

  // A new turn is the lead's. Show it arrive: the lead's stream, at its foot,
  // following. The focus stays in the input, for the turn after this one.
  // The field in New session mode: the question opens a session of its own
  // in this project, and the page goes to it.
  function startNew(text: string): void {
    if (!projectId) return;
    void request<{ session: { id: string } }>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions`,
      { json: { text, mode: 'seed', ...(nextModel ? { model: nextModel } : {}) } },
    ).then(
      (snapshot) => go(`?session=${encodeURIComponent(snapshot.session.id)}#/session`),
      () => setStarting(false),
    );
  }

  function say(text: string): void {
    stream.current?.send({ type: 'session.say', sessionId: thisSession, text });
    setSelected(rootId);
    following.current = true;
    window.requestAnimationFrame(() => {
      if (streamBox.current) streamBox.current.scrollTop = streamBox.current.scrollHeight;
    });
  }

  // Steers the task the stream shows, not necessarily the root: a person
  // reading a reader's own stream steers that reader, not the lead. The
  // composer chooses whether it lands at the next step or the end of the turn.
  // Edit on a message: its text goes back in the field, to change and send.
  function edit(text: string): void {
    setPrefill({ text, key: Date.now() });
  }

  function steer(text: string, when: SteerWhen): void {
    stream.current?.send({ type: 'task.steer', taskId: shown.id, text, when });
  }

  const crumb = (
    <>
      <a href="#/home" className="shrink-0 text-ink-2 hover:text-ink">
        Projects
      </a>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      {/* On a reader's view the title is the way back to the lead, so it is
          a link there; bold and inert, it looked like one and did nothing.
          The title of the project opened on Home flies into it (core/router
          `go`). */}
      {several ? (
        <>
          <span className="max-w-[16rem] min-w-0 truncate text-ink-2" title={title}>
            {title}
          </span>
          <span aria-hidden="true" className="text-ink-3">
            /
          </span>
        </>
      ) : null}
      <h1
        data-flight-target=""
        className="min-w-0 truncate text-sm font-semibold text-ink"
        title={heading}
      >
        {lead ? (
          heading
        ) : (
          <a
            href={`?session=${encodeURIComponent(thisSession)}#/session`}
            onClick={(event) => {
              event.preventDefault();
              open(rootId);
            }}
            className="underline decoration-1 underline-offset-[0.15em]"
          >
            {heading}
          </a>
        )}
      </h1>
      {/* Which task the conversation shows, when it is not the lead's. */}
      {shown.id === root.id ? null : (
        <>
          <span aria-hidden="true" className="text-ink-3">
            /
          </span>
          <span className="min-w-0 shrink-0 truncate text-ink">{shownName}</span>
        </>
      )}
    </>
  );
  // The status is of what the conversation shows: the session for the lead,
  // the task alone for a child. A reader's view once showed the project's
  // spend and time under a "/ reader" breadcrumb.
  const shownSpend = lead ? snapshot.spend.dollars : (snapshot.totals[shown.id]?.dollars ?? 0);
  const status = (
    <>
      <TaskState status={lead ? root.status : shown.status} className="min-w-24" />
      <span title={lead ? 'Spent on this session' : `Spent by ${shownName}`} className="text-ink-2">
        <span className="font-medium text-ink">{money(shownSpend)}</span>{' '}
        {lead ? 'spent' : `spent by ${shownName}`}
      </span>
      {state.stream === 'open' ? null : (
        <span className="text-ink-2" title="The live stream is not connected">
          {state.stream === 'connecting' ? 'Connecting' : 'Offline, retrying'}
        </span>
      )}
    </>
  );
  const stop = running ? (
    <StopControl
      disabled={state.stream !== 'open'}
      onStop={() => stream.current?.send({ type: 'session.stop', sessionId: thisSession })}
    />
  ) : null;

  return (
    <Surfaces collapse="sheet">
      {/* Where you are and how the run stands sit in the bar. Under 720px
          the shell gives each its own line in the bar. */}
      <BarCrumb>{crumb}</BarCrumb>

      <BarStatus>
        {status}
        {/* One time label, in a fixed slot, so the cluster does not move
            when the run ends: the turn's clock while it runs, the time it
            ended after. */}
        {lead ? (
          <span className="min-w-28 text-ink-2 max-split:hidden">
            {clock !== null ? (
              `${clock} elapsed`
            ) : running ? (
              'Running'
            ) : endedAt !== null ? (
              <>
                Ended{' '}
                <time dateTime={new Date(endedAt).toISOString()}>
                  {new Date(endedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </>
            ) : null}
          </span>
        ) : null}
        {/* The model this session chose, on a server that offers a choice. */}
        {models.length > 1 ? (
          <span className="text-ink-2 max-split:hidden">{snapshot.session.model ?? models[0]}</span>
        ) : null}
        {/* Under 720px the first row has no room for Stop, Cancel and
            Details together, so Stop ends the status line instead. */}
        {stop ? <span className="ml-auto roomy:hidden">{stop}</span> : null}
      </BarStatus>

      {/* Over 720px Stop stands right, beside the account: between the status
          and the account it floated alone and read as an afterthought. */}
      <BarActions>
        {stop ? <span className="max-roomy:hidden">{stop}</span> : null}
        <Button
          ref={sheetToggle}
          type="button"
          // Named for what the sheet holds: "Findings 3" opened findings, the
          // call tree and the files, and hid two of the three.
          variant="outline"
          size="sm"
          aria-controls={wellId}
          aria-expanded={sheet}
          onClick={() => setSheet(true)}
          className="split:hidden"
        >
          Details
        </Button>
      </BarActions>

      {/* LIU ZIYANG: the steps of the task shown. LI ZHUOYANG: the composer at its foot. */}
      <SurfaceMain>
        <ScrollRegion
          as="section"
          fades={false}
          ref={streamBox}
          tabIndex={-1}
          onScroll={(event) => {
            following.current = atFoot(event.currentTarget);
          }}
          aria-label={shown.id === root.id ? 'Conversation' : `Conversation of ${shown.agent}`}
          // The region reaches into the gutter, so its scroll bar sits between
          // the conversation and the well and never over the text.
          className="flex-1 outline-none split:-mr-gutter split:pr-gutter"
        >
          <ReplyFiles
            link={(path) =>
              projectId
                ? `${filesRoute(projectId)}/${path.replace(/^\/mnt\//, '')}${path.startsWith('/mnt/workspace/') ? `?session=${encodeURIComponent(snapshot.session.id)}` : ''}`
                : null
            }
          >
            {starting ? (
              // A new session starts on an empty page, as a new chat does: the
              // conversation of this one stayed on screen above the field.
              <div className="flex min-h-full flex-col justify-end pb-6">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink">New session</h2>
                <p className="mt-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setStarting(false)}
                    className="text-ink-2 underline decoration-[1.5px] underline-offset-[0.15em] hover:text-ink"
                  >
                    Back to this session
                  </button>
                </p>
              </div>
            ) : (
              <StepStream
                task={shown}
                steps={snapshot.steps.filter((step) => step.taskId === shown.id)}
                tasks={snapshot.tasks}
                onSelect={open}
                // Regenerate and Edit start a new turn of the lead, so they are
                // offered on the lead's own stream, when a turn can be sent.
                {...(lead && !running && ready ? { onRetry: say, onEdit: edit } : {})}
              />
            )}
          </ReplyFiles>
        </ScrollRegion>
        <div className="flex-none pt-4 pb-6">
          <WaitingNotice task={shown} />
          <Composer
            disabled={!ready}
            running={running}
            steerable={shown.status === 'running'}
            onSay={starting ? startNew : say}
            newSession={starting}
            toolbar={
              starting ? (
                <ModelPicker models={models} value={nextModel} onChange={setNextModel} />
              ) : undefined
            }
            onSteer={steer}
            shownAgent={lead ? null : shownName}
            onAttach={projectId ? (file) => upload(projectId, file) : undefined}
            prefill={prefill}
          />
        </div>
      </SurfaceMain>

      <SurfaceWell
        id={wellId}
        aria-label="What this project has produced"
        title="Findings, call tree and files"
        open={sheet}
        onClose={closeSheet}
      >
        <WellSection id={`${wellId}-findings`} name="Findings" count={state.findings.length}>
          <Findings
            findings={state.findings}
            tasks={snapshot.tasks}
            selected={
              state.findings.find((finding) => finding.id === chosenFinding)?.taskId === shown.id
                ? chosenFinding
                : null
            }
            onSelect={(findingId, taskId) => {
              setChosenFinding(findingId);
              open(taskId);
            }}
          />
        </WellSection>
        <WellSection
          id={`${wellId}-files`}
          name="Files"
          count={files === 'failed' ? undefined : files.length}
        >
          <Files
            files={files}
            projectId={projectId ?? undefined}
            sessionId={sessionId ?? undefined}
            openFolder={
              projectId
                ? (path) =>
                    request<ProjectFile[]>(
                      `${filesRoute(projectId)}?${scopeQuery(path, sessionId ?? undefined)}`,
                    )
                : undefined
            }
          />
        </WellSection>
        <WellSection id={`${wellId}-tree`} name="Call tree">
          <CallTree
            tasks={snapshot.tasks}
            totals={snapshot.totals}
            selected={shown.id}
            onSelect={open}
          />
        </WellSection>
        <WellSection
          id={`${wellId}-sessions`}
          name="Sessions"
          count={sessions.length || undefined}
          action={
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={starting}
              onClick={() => {
                setStarting(!starting);
                document.querySelector<HTMLTextAreaElement>('textarea[name="say"]')?.focus();
              }}
            >
              {starting ? 'Cancel' : '+ New'}
            </Button>
          }
        >
          <Sessions sessions={sessions} current={snapshot.session.id} />
        </WellSection>
        {/* The space under the last section. The region keeps no block padding
            of its own (ScrollRegion), so its end is a child. */}
        <div aria-hidden="true" className="h-6" />
      </SurfaceWell>
    </Surfaces>
  );
}
