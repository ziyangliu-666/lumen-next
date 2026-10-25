import { useEffect, useMemo, useState, type FormEvent, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { chooseAgent, useAgents, type Agent } from '@/core/agents';
import { useCurrentAccount } from '@/core/auth';
import { go } from '@/core/router';
import { PageCrumb } from '@/core/shell';
import { cn } from '@/lib/utils';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { ScrollRegion } from '@/ui/scroll-region';
import { Field } from '@/ui/section';
import { RegionName, SurfaceMain, Surfaces, SurfaceWell } from '@/ui/surfaces';
import { Textarea } from '@/ui/textarea';

// The agent registry: the producer's side of the platform. On paper, every
// published agent, with how much it is used; on the well, the form that
// publishes one. The routes are the public API's (/api/v1/agents and
// /api/v1/usage), with the sign-in cookie, so what is published here is what
// the literature watch asks with through its API key.

interface Usage {
  readonly slug: string;
  readonly sessions: number;
  readonly cost: number;
  readonly medianSecondsToRest: number | null;
}

interface UsageBody {
  readonly asProducer?: readonly Usage[];
}

const SLUG = /^[a-z][a-z0-9-]{2,39}$/;
const INSTRUCTIONS_LIMIT = 4000;

const ROW_PAPER =
  'bg-[linear-gradient(to_right,transparent,color-mix(in_srgb,var(--paper)_90%,transparent)_24px,color-mix(in_srgb,var(--paper)_90%,transparent)_calc(100%-24px),transparent)]';

/** "Literature Scout" → "literature-scout": the slug a name suggests. */
function slugOf(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40);
}

function money(dollars: number): string {
  return `$${dollars.toFixed(4)}`;
}

interface Template {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly instructions: string;
}

// Ready agents for a demonstration. Each hands the work to readers that
// search and record findings (the host has no sandbox), so a run shows a call
// tree and findings.
const TEMPLATES: readonly Template[] = [
  {
    name: 'Literature Scout',
    slug: 'literature-scout',
    description: 'Finds recent papers on a topic and says what is new.',
    instructions: [
      'For the topic in the question:',
      '1. Search arXiv for papers from the last twelve months, and pick the three most relevant.',
      "2. Delegate one reader per paper, all at once. In each reader's task, give the topic and the paper title, and ask it to search arXiv for that paper and record exactly one finding with record_finding: title = the short name of the paper; text = authors, year, arXiv link, and one line on what it adds.",
      '3. Reply with a short digest: what is new, what is still open, and which paper to read first.',
      'Give only papers a search returned.',
    ].join('\n'),
  },
  {
    name: 'Sequence Detective',
    slug: 'sequence-detective',
    description: 'Names an integer sequence from its first terms, with OEIS.',
    instructions: [
      'For the sequence or counting problem in the question:',
      '1. Search OEIS with the terms, and pick up to three candidate sequences.',
      "2. Delegate one reader per candidate, all at once. In each reader's task, give the A-number, and ask it to search OEIS for it and record exactly one finding with record_finding: title = the A-number and name; text = the terms that match, a formula, and where it differs.",
      '3. Reply with the best match and how sure you are.',
    ].join('\n'),
  },
  {
    name: 'Related Work Mapper',
    slug: 'related-work',
    description: 'Maps earlier, parallel and follow-up work around an idea.',
    instructions: [
      'For the paper or idea in the question:',
      '1. Search arXiv for the idea, and from the results name three directions: earlier foundations, parallel approaches, and recent follow-ups.',
      "2. Delegate one reader per direction, all at once. In each reader's task, name the direction, and ask it to search arXiv and record exactly one finding with record_finding: title = the direction; text = the two most relevant papers, with authors, year and link.",
      '3. Reply with a short map of how the directions connect.',
      'Give only papers a search returned.',
    ].join('\n'),
  },
  {
    name: 'Open Problem Finder',
    slug: 'open-problems',
    description: 'Lists open problems and conjectures stated in recent papers.',
    instructions: [
      'For the area in the question:',
      '1. Search arXiv for recent papers that state open problems or conjectures in it.',
      "2. Delegate three readers, one per problem, all at once. In each reader's task, name the problem, and ask it to search arXiv and record exactly one finding with record_finding: title = the problem in a few words; text = where it is stated (authors, year, link) and what is known.",
      '3. Reply with the problems in order of how approachable they look.',
    ].join('\n'),
  },
  {
    name: 'Method Comparer',
    slug: 'method-comparer',
    description: 'Compares three methods for one problem from the literature.',
    instructions: [
      'For the problem in the question:',
      '1. Search arXiv and pick three different methods used for it.',
      "2. Delegate one reader per method, all at once. In each reader's task, name the method, and ask it to search arXiv and record exactly one finding with record_finding: title = the method; text = the key paper (authors, year, link), its strength and its limit.",
      '3. Reply with a short comparison and which method to try first.',
    ].join('\n'),
  },
];

/** A random template, not the one just shown, with a slug no agent has yet. */
function pickTemplate(previous: string, taken: ReadonlySet<string>): Template {
  const others = TEMPLATES.filter((item) => item.name !== previous);
  const free = others.filter((item) => !taken.has(item.slug));
  const pool = free.length > 0 ? free : others;
  const template = pool[Math.floor(Math.random() * pool.length)] ?? TEMPLATES[0]!;
  let slug = template.slug;
  for (let n = 2; taken.has(slug); n += 1) slug = `${template.slug}-${n}`;
  return { ...template, slug };
}

export function Agents(): JSX.Element {
  const { state: account } = useCurrentAccount();
  const me = account.status === 'ready' ? account.account.displayName : null;
  const [revision, setRevision] = useState(0);
  const agents = useAgents(true, revision);
  const [usage, setUsage] = useState<ReadonlyMap<string, Usage>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    request<UsageBody>('/api/v1/usage', { cache: 'no-store' })
      .then((body) => {
        if (!active) return;
        setUsage(new Map((body.asProducer ?? []).map((row) => [row.slug, row])));
      })
      .catch(() => undefined)
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [revision]);

  // Newest first, and the one just published at the top.
  const ordered = useMemo(
    () =>
      [...agents].sort((a, b) =>
        a.slug === fresh ? -1 : b.slug === fresh ? 1 : b.createdAt.localeCompare(a.createdAt),
      ),
    [agents, fresh],
  );

  async function withdraw(agent: Agent): Promise<void> {
    setWithdrawing(agent.slug);
    setListError(null);
    try {
      await request<void>(`/api/v1/agents/${encodeURIComponent(agent.slug)}`, {
        method: 'DELETE',
      });
      setRevision((n) => n + 1);
    } catch {
      setListError(`${agent.name} was not withdrawn. Refresh and try again.`);
    } finally {
      setWithdrawing(null);
    }
  }

  return (
    <>
      <PageCrumb page="Agents" />
      <Surfaces collapse="stack">
        <SurfaceMain className="bg-transparent bg-linear-to-b from-paper/85 from-20% via-paper/60 via-45% to-transparent to-85%">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4">
            <RegionName id="agents-name" count={agents.length} className="mb-0">
              Agents
            </RegionName>
            <Button variant="outline" size="sm" onClick={() => setRevision((n) => n + 1)}>
              Refresh
            </Button>
          </div>
          {listError ? (
            <Alert title="The agent was not withdrawn" className="mt-3">
              {listError}
            </Alert>
          ) : null}
          <ScrollRegion
            as="section"
            aria-labelledby="agents-name"
            className="mt-4 -ml-3 min-h-0 pl-3 max-split:-mr-3 max-split:pr-3 split:-mr-gutter split:flex-1 split:pr-gutter"
          >
            {loaded && agents.length === 0 ? (
              <p className="pt-2 text-ink-2">No agents yet. Publish the first one.</p>
            ) : null}
            <ol>
              {ordered.map((agent) => (
                <AgentRow
                  key={agent.slug}
                  agent={agent}
                  usage={usage.get(agent.slug)}
                  mine={me !== null && agent.owner === me}
                  fresh={agent.slug === fresh}
                  withdrawing={withdrawing === agent.slug}
                  onWithdraw={() => {
                    void withdraw(agent);
                  }}
                />
              ))}
            </ol>
            <div className="pb-8" />
          </ScrollRegion>
        </SurfaceMain>
        <SurfaceWell aria-label="Publish an agent">
          <Publish
            taken={new Set(agents.map((agent) => agent.slug))}
            onPublished={(slug) => {
              setFresh(slug);
              setRevision((n) => n + 1);
            }}
          />
        </SurfaceWell>
      </Surfaces>
    </>
  );
}

function AgentRow({
  agent,
  usage,
  mine,
  fresh,
  withdrawing,
  onWithdraw,
}: {
  agent: Agent;
  usage: Usage | undefined;
  mine: boolean;
  fresh: boolean;
  withdrawing: boolean;
  onWithdraw: () => void;
}): JSX.Element {
  const [confirm, setConfirm] = useState(false);
  return (
    <li
      className={cn(
        'group/row relative -mx-6 px-6 py-5',
        ROW_PAPER,
        'after:absolute after:inset-x-6 after:top-0 after:h-px after:bg-rule-minor first:after:hidden',
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-ink">{agent.name}</h3>
        <span className="font-mono text-xs text-ink-2">{agent.slug}</span>
        {fresh ? (
          <span className="text-sm text-ink-2">Published</span>
        ) : mine ? (
          <span className="text-sm text-ink-2">Yours</span>
        ) : null}
      </div>
      <p className="mt-1 max-w-[44em] text-sm text-ink">{agent.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2 tabular-nums">
        <span>{agent.owner}</span>
        <span>
          <span className="font-medium text-ink">{usage?.sessions ?? 0}</span>{' '}
          {usage?.sessions === 1 ? 'run' : 'runs'}
        </span>
        {usage && usage.sessions > 0 ? (
          <span>
            <span className="font-medium text-ink">{money(usage.cost)}</span> spent
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={fresh ? 'default' : 'outline'}
          onClick={() => {
            chooseAgent(agent.slug);
            go('#/home');
          }}
        >
          Ask with this agent
        </Button>
        {mine ? (
          confirm ? (
            <>
              <Button size="sm" variant="destructive" disabled={withdrawing} onClick={onWithdraw}>
                {withdrawing ? 'Withdrawing…' : 'Withdraw it'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
              Withdraw
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}

function Publish({
  taken,
  onPublished,
}: {
  taken: ReadonlySet<string>;
  onPublished: (slug: string) => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const shownSlug = slugEdited ? slug : slugOf(name);
  const slugOk = SLUG.test(shownSlug);
  const ready =
    name.trim() !== '' &&
    slugOk &&
    description.trim() !== '' &&
    instructions.trim() !== '' &&
    instructions.length <= INSTRUCTIONS_LIMIT;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    setDone(null);
    try {
      await request('/api/v1/agents', {
        json: {
          slug: shownSlug,
          name: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
        },
      });
      setDone(name.trim());
      onPublished(shownSlug);
      setName('');
      setSlug('');
      setSlugEdited(false);
      setDescription('');
      setInstructions('');
    } catch (failure) {
      setError(
        failure instanceof RequestFailure && failure.status === 409
          ? `The slug "${shownSlug}" is taken. Choose another.`
          : failure instanceof Error
            ? failure.message
            : 'The agent was not published.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="publish-name" className="pt-4">
      <div className="mb-4 flex min-h-8 items-center justify-between gap-4">
        <RegionName id="publish-name" className="mb-0">
          Publish an agent
        </RegionName>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const template = pickTemplate(name, taken);
            setName(template.name);
            setSlug(template.slug);
            setSlugEdited(true);
            setDescription(template.description);
            setInstructions(template.instructions);
            setError(null);
            setDone(null);
          }}
        >
          Random template
        </Button>
      </div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4" aria-busy={pending}>
        <div className="grid gap-4 roomy:grid-cols-2">
          <Field>
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="agent-slug">Slug</Label>
            <Input
              id="agent-slug"
              value={shownSlug}
              maxLength={40}
              spellCheck={false}
              aria-invalid={shownSlug !== '' && !slugOk}
              className="font-mono"
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor="agent-description">Description</Label>
          <Input
            id="agent-description"
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="agent-instructions">Instructions</Label>
          <Textarea
            id="agent-instructions"
            value={instructions}
            rows={7}
            className="max-h-[36svh] min-h-36 font-mono text-sm leading-relaxed"
            onChange={(event) => setInstructions(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!ready || pending}>
            {pending ? 'Publishing…' : 'Publish'}
          </Button>
          <p aria-live="polite" className="text-sm text-ink-2">
            {shownSlug !== '' && !slugOk
              ? 'Slug: lowercase letters, digits and dashes.'
              : done
                ? `${done} is published.`
                : ''}
          </p>
        </div>
        {error ? <Alert title="The agent was not published">{error}</Alert> : null}
      </form>
    </section>
  );
}
