import { useEffect, useState, type JSX } from 'react';
import { go } from './router';
import { request } from './api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';

// The agent registry, as the web app sees it (docs/platform/public-api.md).
// The web app is a consumer of the same /api/v1 routes as the literature
// watch; it uses the sign-in cookie where the watch uses an API key.

export interface Agent {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  readonly createdAt: string;
}

/** The lead with no agent's instructions: the picker's first entry. */
export const NO_AGENT = '';
const PUBLISH = '__publish';
const CHOSEN = 'lumen.agent';

/** Published agents; empty until read, when signed out, and on failure. */
export function useAgents(enabled: boolean, revision = 0): readonly Agent[] {
  const [agents, setAgents] = useState<readonly Agent[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    request<{ items?: Agent[] }>('/api/v1/agents', { cache: 'no-store' }).then(
      (body) => active && setAgents(body.items ?? []),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [enabled, revision]);
  return enabled ? agents : [];
}

/**
 * Remembers the agent for new projects in this tab: "Ask with this agent" on
 * #/agents, or a pick in the field. It stays until another pick.
 */
export function chooseAgent(slug: string): void {
  try {
    sessionStorage.setItem(CHOSEN, slug);
  } catch {
    /* The picker still works by hand. */
  }
}

/** The agent chosen in this tab, if any. */
export function chosenAgent(): string {
  try {
    return sessionStorage.getItem(CHOSEN) ?? NO_AGENT;
  } catch {
    return NO_AGENT;
  }
}

function AgentIcon(): JSX.Element {
  // A small spark: the agent is lumen's lead with a producer's instructions.
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0">
      <path
        d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M3.4 12.6l2.1-2.1M10.5 5.5l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * The agent for a new project, quiet in the field's toolbar beside the model.
 * "Lumen" is the plain lead. The last entry opens the registry to publish one.
 */
export function AgentPicker({
  agents,
  value,
  onChange,
}: {
  agents: readonly Agent[];
  value: string;
  onChange: (slug: string) => void;
}): JSX.Element {
  // A slug that is no longer published (withdrawn since) falls back to Lumen.
  const shown = agents.some((agent) => agent.slug === value) ? value : NO_AGENT;
  return (
    <Select
      value={shown === NO_AGENT ? 'lumen' : shown}
      onValueChange={(next) => {
        // Radix reports '' while the value is not among the items yet (the
        // list is still loading); that is not a pick.
        if (!next) return;
        if (next === PUBLISH) {
          go('#/agents');
          return;
        }
        onChange(next === 'lumen' ? NO_AGENT : next);
      }}
    >
      <SelectTrigger
        aria-label="Agent"
        size="sm"
        className={
          'h-8! w-auto max-w-56 gap-1.5 border-transparent bg-transparent px-2 text-sm hover:text-ink ' +
          (shown === NO_AGENT ? 'text-ink-2' : 'text-ink')
        }
      >
        <AgentIcon />
        <SelectValue>
          {shown === NO_AGENT
            ? 'Lumen'
            : (agents.find((agent) => agent.slug === shown)?.name ?? 'Lumen')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-64">
        <SelectItem value="lumen">
          <span className="grid gap-0.5 text-left">
            <span>Lumen</span>
            <span className="text-xs text-ink-2">The lead, with no agent</span>
          </span>
        </SelectItem>
        {agents.length > 0 ? <SelectSeparator /> : null}
        {agents.map((agent) => (
          <SelectItem key={agent.slug} value={agent.slug}>
            <span className="grid gap-0.5 text-left">
              <span className="truncate">{agent.name}</span>
              <span className="truncate font-mono text-xs text-ink-2">
                {agent.slug} · {agent.owner}
              </span>
            </span>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={PUBLISH}>
          <span className="text-ink-2">Publish an agent…</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * The agent that leads a session, for the session's bar: nothing when the
 * plain lead runs it. Read once from the public API's answer route.
 */
export function SessionAgent({ sessionId }: { sessionId: string }): JSX.Element | null {
  const [agent, setAgent] = useState<{ session: string; slug: string; name: string } | null>(null);
  useEffect(() => {
    let active = true;
    request<{ agent?: string | null }>(`/api/v1/questions/${encodeURIComponent(sessionId)}`)
      .then(async (body) => {
        if (!body.agent) return;
        const slug = body.agent;
        const named = await request<{ name?: string }>(
          `/api/v1/agents/${encodeURIComponent(slug)}`,
        ).catch(() => ({ name: slug }));
        if (active) setAgent({ session: sessionId, slug, name: named.name ?? slug });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sessionId]);
  // Another session's agent, until this one's answer arrives, is not shown.
  if (!agent || agent.session !== sessionId) return null;
  return (
    <a
      href="#/agents"
      title={`Led by the agent ${agent.slug}`}
      className="inline-flex shrink-0 items-center gap-1.5 border border-rule-minor px-2 py-0.5 text-xs text-ink hover:border-ink"
    >
      <AgentIcon />
      {agent.name}
    </a>
  );
}
