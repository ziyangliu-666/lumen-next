import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Step, Task } from '@lumen/contracts';
import {
  CallTree,
  Composer,
  Files,
  Findings,
  receiptOf,
  ReplyActions,
  Sessions,
  StepStream,
  StopControl,
  WaitingNotice,
} from './parts';

// Rendered to a string: no browser, no clicks, but every class of "the page
// stopped drawing it" is caught here, which no other test does.

const task = (id: string, parentId: string | null, over: Partial<Task> = {}): Task => ({
  id,
  sessionId: 's1',
  parentId,
  agent: parentId ? 'reader' : 'lead',
  title: `title of ${id}`,
  depth: parentId ? 1 : 0,
  status: 'ended',
  ownCost: { dollars: 0 },
  startedAt: 0,
  endedAt: 1,
  ...over,
});
const step = (index: number, kind: Step['kind'], text: string, detail?: Step['detail']): Step => ({
  taskId: 'lead',
  index,
  kind,
  text,
  ...(detail ? { detail } : {}),
});
const noop = (): void => undefined;
const lead = task('lead', null);

function stream(steps: Step[], tasks: Task[] = [lead]): string {
  return renderToStaticMarkup(
    <StepStream task={lead} steps={steps} tasks={tasks} onSelect={noop} />,
  );
}

describe('session page: a tool step', () => {
  const search = step(0, 'tool', 'search: demo, no network', {
    tool: 'search',
    durationMs: 6000,
    cost: { dollars: 0.01 },
    rows: [
      { source: 'arxiv', text: 'permutation statistics', result: '41 papers' },
      { source: 'oeis', text: 'pop-stack preimages', result: 'nothing', empty: true },
    ],
  });

  it('shows its name, what it took and what it cost', () => {
    const html = stream([search]);

    expect(html).toContain('>search<');
    expect(html).toContain('6 s, $0.0100');
  });

  it('draws every row: source, query, result', () => {
    const html = stream([search]);

    for (const text of [
      'arxiv',
      'permutation statistics',
      '41 papers',
      'oeis',
      'pop-stack preimages',
    ]) {
      expect(html).toContain(text);
    }
  });

  it('marks the row that found nothing in words and in weight, not by colour alone', () => {
    const html = stream([search]);

    expect(html).toContain('found nothing: </span>nothing');
    // Marked by its words, not by weight: a bold "nothing" read as an alert.
    expect(html).not.toMatch(/font-semibold[^"]*text-ink[^"]*">nothing/);
    // Red means "waits on you" and nothing else, so an empty row is never red.
    expect(html).not.toMatch(/text-(signal|decide)/);
  });

  it('shows rows or output in place of the line of text, and the line when there is nothing else', () => {
    expect(stream([search])).not.toContain('demo, no network');
    expect(stream([step(0, 'tool', 'search: demo, no network', { tool: 'search' })])).toContain(
      'demo, no network',
    );
  });

  it('puts output in a block that scrolls instead of growing the page, and escapes it', () => {
    const html = stream([
      step(0, 'tool', 'run: x', { tool: 'run', output: '$ ls\n<script>alert(1)</script>' }),
    ]);

    expect(html).toMatch(/<pre[^>]*max-h-80[^>]*overflow-auto/);
    // A block that scrolls takes the focus, or a keyboard cannot scroll it.
    expect(html).toMatch(/<pre[^>]*tabindex="0"/);
    expect(html).toMatch(/<pre[^>]*aria-label="run output"/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('writes "tool call" for a tool that reports neither time nor cost, and no price for a free one', () => {
    expect(receiptOf(step(0, 'tool', 'save: f'))).toBe('tool call');
    expect(receiptOf(step(0, 'tool', 'run: f', { durationMs: 8940, cost: { dollars: 0 } }))).toBe(
      '8.9 s',
    );
  });

  it('draws a step recorded before steps carried anything, from its text alone', () => {
    const html = stream([step(0, 'tool', 'search: "fusion" (demo)')]);

    expect(html).toContain('>search<');
    expect(html).toContain('&quot;fusion&quot; (demo)');
  });
});

describe('session page: the other blocks', () => {
  it('lists under a delegate step the children it names, with their status, and no others', () => {
    const tasks = [
      lead,
      task('r1', 'lead', { title: 'what is known' }),
      task('r2', 'lead', { title: 'what changed', status: 'running', endedAt: null }),
      task('r3', 'lead', { title: 'a later turn' }),
    ];
    const html = stream(
      [step(0, 'delegate', 'delegated 2 in parallel', { childTaskIds: ['r1', 'r2'] })],
      tasks,
    );

    expect(html).toContain('2 in parallel');
    expect(html).toContain('what is known');
    expect(html).toContain('what changed');
    expect(html).toContain('>Running<');
    expect(html).not.toContain('a later turn');
  });

  it('opens the stream with what the task was asked: You for the lead, Task for a child', () => {
    expect(stream([])).toContain('>You<');
    const child = task('r1', 'lead');
    const html = renderToStaticMarkup(
      <StepStream task={child} steps={[]} tasks={[lead, child]} onSelect={noop} />,
    );
    expect(html).toContain('>Task<');
    expect(html).toContain('title of r1');
  });

  it('draws you, thinking and reply each in its own block', () => {
    const html = stream([
      step(0, 'you', 'push it to n = 11'),
      step(1, 'thinking', 'that is 40 million permutations'),
      step(2, 'reply', 'it holds at n = 11'),
    ]);

    expect(html).toMatch(/data-step="you"[^>]*>.*push it to n = 11/s);
    expect(html).toMatch(/data-step="thinking"[^>]*>.*that is 40 million permutations/s);
    expect(html).toMatch(/data-step="reply"[^>]*>.*it holds at n = 11/s);
    // Your turns sit on the well; the work hangs on a rule; the reply sits below it.
    expect(html).toMatch(/data-step="you" class="[^"]*bg-well/);
    expect(html).toMatch(/border-l[^>]*>.*data-step="thinking"/s);
    expect(html).not.toMatch(/border-l[^>]*>(?:(?!<\/div>).)*data-step="reply"/s);
  });

  it('starts a new turn at each thing you say, and keeps the latest exchange at least a screen tall', () => {
    const html = stream([
      step(0, 'reply', 'first answer'),
      step(1, 'you', 'push it to n = 11'),
      step(2, 'reply', 'second answer'),
    ]);

    expect(html.match(/<article/g)).toHaveLength(4);
    // The region opens at its end. With the latest exchange as tall as the
    // region, that is the start of your latest turn.
    expect(html).toMatch(
      /<div data-latest="" class="min-h-full">.*push it to n = 11.*second answer/s,
    );
    expect(html).not.toMatch(/<div data-latest="" class="min-h-full">.*first answer/s);
  });
});

describe('session page: the text of a reply', () => {
  it('draws bold, code, a list and a heading, and never the marks themselves', () => {
    const html = stream([
      step(
        0,
        'reply',
        '## Known results\n\nEvery **pop-stack** sortable permutation is `West-2` sortable.\n\n- one\n- **two**\n\nSo the answer is **yes**.',
      ),
    ]);
    expect(html).toContain('<strong class="font-semibold">pop-stack</strong>');
    expect(html).toContain('<code class="font-mono text-[0.9em]">West-2</code>');
    expect(html).toMatch(/<ul[^>]*><li>one<\/li><li><strong[^>]*>two<\/strong><\/li><\/ul>/);
    expect(html).toMatch(/<p class="font-semibold">Known results<\/p>/);
    expect(html).not.toContain('**');
    expect(html).not.toContain('##');
  });

  it('keeps a plain reply as one paragraph and escapes what looks like HTML', () => {
    const html = stream([step(0, 'reply', 'a < b and <script>x</script>')]);
    expect(html).toContain('a &lt; b and &lt;script&gt;x&lt;/script&gt;');
  });
});

describe('session page: a task that waits', () => {
  it('says the task needs an approval and points to Wallet, and says nothing otherwise', () => {
    const waiting = renderToStaticMarkup(<WaitingNotice task={{ ...lead, status: 'waiting' }} />);
    expect(waiting).toContain('needs your approval');
    expect(waiting).toContain('href="#/settings"');
    expect(renderToStaticMarkup(<WaitingNotice task={lead} />)).toBe('');
  });
});

describe('session page: the rail', () => {
  it('draws the tree with its branches, marks the open task, and shows a cost in the row', () => {
    const tasks = [lead, task('r1', 'lead'), task('r2', 'lead')];
    const html = renderToStaticMarkup(
      <CallTree
        tasks={tasks}
        totals={{ lead: { dollars: 0.03 }, r1: { dollars: 0.01 } }}
        selected="r1"
        onSelect={noop}
      />,
    );

    expect(html).toContain('├ ');
    expect(html).toContain('└ ');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    // In the row, where a keyboard and a touch screen can see it.
    expect(html).toContain('>$0.0300<');
    expect(html).toContain('>$0.0100<');
  });

  it('lists findings with the agent that recorded them, and says so when there are none', () => {
    const html = renderToStaticMarkup(
      <Findings
        findings={[{ id: 'f1', taskId: 'r1', text: 'holds at n = 11' }]}
        tasks={[lead, task('r1', 'lead')]}
        onSelect={noop}
      />,
    );
    expect(html).toContain('holds at n = 11');
    expect(html).toContain('>reader<');
    expect(
      renderToStaticMarkup(<Findings findings={[]} tasks={[lead]} onSelect={noop} />),
    ).toContain('None yet.');
  });

  it('offers Steer while a run is going, and Send when it is not, each with a name', () => {
    const composer = (running: boolean, steerable = true): string =>
      renderToStaticMarkup(
        <Composer
          disabled={false}
          running={running}
          steerable={steerable}
          onSay={noop}
          onSteer={noop}
        />,
      );

    // Stop is in the bar now (StopControl), not in the field.
    expect(composer(true)).not.toContain('>Stop<');
    expect(composer(true)).toContain('aria-label="Steer"');
    expect(composer(true)).not.toContain('aria-label="Send"');
    expect(composer(true)).toContain('>Steer the task shown<');
    // A steer lands at the next step; there is no timing switch to read.
    expect(composer(true)).not.toContain('aria-pressed');
    expect(composer(true)).toContain('placeholder="Steer lumen…"');
    expect(composer(false)).toContain('aria-label="Send"');
    // Nothing typed yet: send waits for text.
    expect(composer(false)).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(composer(false)).toContain('>Reply to lumen<');
    expect(composer(false)).not.toContain('aria-pressed');
  });

  it('names the reader shown as the one a steer goes to', () => {
    const html = renderToStaticMarkup(
      <Composer
        disabled={false}
        running={true}
        steerable={true}
        shownAgent="reader 1"
        onSay={noop}
        onSteer={noop}
      />,
    );
    expect(html).toContain('placeholder="Steer reader 1…"');
  });

  it.each([
    { disabled: true, steerable: true },
    { disabled: false, steerable: false },
  ])('disables Steer when the socket or the task cannot accept a steer: %j', (props) => {
    const html = renderToStaticMarkup(
      <Composer {...props} running={true} onSay={noop} onSteer={noop} />,
    );
    expect(html).toMatch(/<button[^>]*aria-label="Steer"[^>]*disabled=""/);
  });

  it('disables the field once the task shown is not the one running', () => {
    const html = renderToStaticMarkup(
      <Composer disabled={false} running={true} steerable={false} onSay={noop} onSteer={noop} />,
    );
    expect(html).toMatch(/<textarea[^>]*disabled=""/);
    expect(html).toContain('Nothing to steer right now');
  });

  it('keeps a new turn writable while the socket is down, and only sending is off', () => {
    const html = renderToStaticMarkup(
      <Composer disabled={true} running={false} steerable={false} onSay={noop} onSteer={noop} />,
    );
    expect(html).not.toMatch(/<textarea[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*aria-label="Send"[^>]*disabled=""/);
  });
});

describe('session page: the bar and the well', () => {
  // Outlined at every width: bare text on a desktop read as a weak control.
  it('draws Stop as an outlined square and a word until it is armed', () => {
    const html = renderToStaticMarkup(<StopControl disabled={false} onStop={noop} />);
    expect(html).toContain('>Stop<');
    expect(html).toContain('data-variant="outline"');
    expect(html).not.toContain('Stop now?');
  });

  it('shows the three newest findings first, and offers the rest', () => {
    const findings = [1, 2, 3, 4, 5].map((n) => ({
      id: `f${n}`,
      taskId: 'lead',
      text: `claim ${n}`,
    }));
    const html = renderToStaticMarkup(
      <Findings findings={findings} tasks={[lead]} onSelect={noop} />,
    );
    expect(html).toMatch(/claim 5.*claim 4.*claim 3/s);
    expect(html).not.toContain('claim 2');
    expect(html).toContain('Show all 5');
    expect(html).toContain('Recorded by <span>lumen</span>');
  });

  it('lists the files newest first, marks a folder, and says so when there are none or they failed', () => {
    const html = renderToStaticMarkup(
      <Files
        files={[
          { name: 'old.py', virtualPath: '/mnt/output/old.py', kind: 'file', modifiedAt: 1 },
          { name: 'results', virtualPath: '/mnt/output/results', kind: 'directory', modifiedAt: 2 },
        ]}
      />,
    );
    expect(html).toMatch(/results\/.*old\.py/s);
    expect(html).not.toContain('/mnt/');
    expect(renderToStaticMarkup(<Files files={[]} />)).toContain('None yet.');
    expect(renderToStaticMarkup(<Files files="failed" />)).toContain('could not be read');
  });

  it('lists attachments in their own group and makes a folder a control when it can open', () => {
    const html = renderToStaticMarkup(
      <Files
        projectId="p1"
        files={[
          { name: 'seq.csv', virtualPath: '/mnt/upload/seq.csv', kind: 'file', modifiedAt: 1 },
          { name: 'results', virtualPath: '/mnt/output/results', kind: 'directory', modifiedAt: 2 },
        ]}
        openFolder={() => Promise.resolve([])}
      />,
    );
    expect(html).toMatch(/Attached.*seq\.csv.*Kept.*results\//s);
    expect(html).toContain('href="/api/projects/p1/files/upload/seq.csv"');
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>results\/<\/button>/);
  });
});

describe('session page: under an answer', () => {
  it('offers Copy and Copy link, each with a name', () => {
    const html = renderToStaticMarkup(<ReplyActions text="**42**" />);
    expect(html).toContain('aria-label="Copy"');
    expect(html).toContain('aria-label="Copy link"');
  });
});

describe('session page: the project sessions', () => {
  it('lists them newest first, marks this one, and offers New session', () => {
    const html = renderToStaticMarkup(
      <Sessions
        sessions={[
          { id: 's1', title: 'older', status: 'ended', startedAt: 1 },
          { id: 's2', title: 'newer', status: 'running', startedAt: 2 },
        ]}
        current="s1"
        starting={false}
        onNew={() => undefined}
      />,
    );
    expect(html).toMatch(/newer.*older/s);
    expect(html).toMatch(/aria-current="page"[^>]*>.*older/s);
    expect(html).toContain('New session');
  });
});
