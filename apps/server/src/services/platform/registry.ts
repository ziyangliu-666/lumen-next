// The agent registry, the question intents and the usage reads
// (docs/platform/public-api.md). All three are SQL over the shared database,
// so the project, session and worker services each build them in-process.
import type { Db, Queryable } from '../../core/db/db.js';

export const SLUG = /^[a-z][a-z0-9-]{2,39}$/;
export const MAX_INSTRUCTIONS = 4000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export interface Agent {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly ownerAccountId: string;
  /** The owner's display name: what a reader of the registry sees. */
  readonly owner: string;
  readonly createdAt: string;
  readonly withdrawnAt: string | null;
}

interface AgentRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly ownerAccountId: string;
  readonly owner: string;
  readonly createdAt: Date;
  readonly withdrawnAt: Date | null;
}

const AGENT_COLUMNS = `g.id, g.slug, g.name, g.description, g.instructions,
  g.owner_account_id as "ownerAccountId", a.display_name as owner,
  g.created_at as "createdAt", g.withdrawn_at as "withdrawnAt"`;
const AGENT_FROM = 'from platform_agents g join accounts a on a.id = g.owner_account_id';

function agentOfRow(row: AgentRow): Agent {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
  };
}

/** The slug is taken, by a live agent or a withdrawn one. */
export class SlugTaken extends Error {
  constructor(slug: string) {
    super(`the slug "${slug}" is taken`);
    this.name = 'SlugTaken';
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export class AgentStore {
  constructor(private readonly db: Queryable) {}

  async listPublished(): Promise<Agent[]> {
    const rows = await this.db.query<AgentRow>(
      `select ${AGENT_COLUMNS} ${AGENT_FROM} where g.withdrawn_at is null order by g.slug`,
    );
    return rows.map(agentOfRow);
  }

  /** The agent with this slug, withdrawn or not. */
  async bySlug(slug: string): Promise<Agent | null> {
    if (!SLUG.test(slug)) return null;
    const [row] = await this.db.query<AgentRow>(
      `select ${AGENT_COLUMNS} ${AGENT_FROM} where g.slug = $1`,
      [slug],
    );
    return row ? agentOfRow(row) : null;
  }

  async publish(input: {
    ownerAccountId: string;
    slug: string;
    name: string;
    description: string;
    instructions: string;
  }): Promise<Agent> {
    try {
      await this.db.query(
        `insert into platform_agents (owner_account_id, slug, name, description, instructions)
         values ($1, $2, $3, $4, $5)`,
        [input.ownerAccountId, input.slug, input.name, input.description, input.instructions],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new SlugTaken(input.slug);
      throw error;
    }
    return (await this.bySlug(input.slug))!;
  }

  async withdraw(id: string): Promise<void> {
    await this.db.query(
      'update platform_agents set withdrawn_at = now() where id = $1 and withdrawn_at is null',
      [id],
    );
  }
}

/** What the worker needs to run a root turn with an agent's instructions. */
export interface IntentAgent {
  readonly slug: string;
  readonly name: string;
  readonly instructions: string;
}

/** How far back an unclaimed intent may match a session by its question. */
export const INTENT_WINDOW_SECONDS = 60;

export class IntentStore {
  constructor(private readonly db: Db) {}

  /** Step 1 of "How a chosen agent reaches the worker": before the session exists. */
  async insert(accountId: string, agentId: string | null, question: string): Promise<string> {
    const [row] = await this.db.query<{ id: string }>(
      `insert into platform_question_intents (account_id, agent_id, question)
       values ($1, $2, $3) returning id`,
      [accountId, agentId, question],
    );
    return row!.id;
  }

  /**
   * Step 2: the session exists. The worker may have claimed the row first;
   * that is not an error. A unique violation means the worker matched this
   * session to another identical question of the same account, and that row
   * now speaks for it.
   */
  async attach(intentId: string, sessionId: string): Promise<void> {
    try {
      await this.db.query(
        `update platform_question_intents set session_id = $2
          where id = $1 and session_id is null`,
        [intentId, sessionId],
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  /** The project was not created: the row must not be claimed by a later question. */
  async discard(intentId: string): Promise<void> {
    await this.db.query(
      'delete from platform_question_intents where id = $1 and session_id is null',
      [intentId],
    );
  }

  /**
   * Step 3, in the worker on a root turn. The row with this session id; else
   * the newest unclaimed row of this account with this question from the last
   * minute, claimed under FOR UPDATE SKIP LOCKED so two workers never take the
   * same row. Null: the question did not come through the API, or no agent was
   * chosen.
   */
  async claim(sessionId: string, accountId: string, question: string): Promise<IntentAgent | null> {
    if (!isUuid(sessionId) || !isUuid(accountId)) return null;
    const agentOf = async (sql: Queryable): Promise<IntentAgent | null> => {
      const [row] = await sql.query<IntentAgent>(
        `select g.slug, g.name, g.instructions
           from platform_question_intents i join platform_agents g on g.id = i.agent_id
          where i.session_id = $1`,
        [sessionId],
      );
      return row ?? null;
    };
    const exists = await this.db.query(
      'select 1 from platform_question_intents where session_id = $1',
      [sessionId],
    );
    if (exists.length > 0) return agentOf(this.db);
    try {
      return await this.db.withTransaction(async (tx) => {
        const [row] = await tx.query<{ id: string }>(
          `select id from platform_question_intents
            where session_id is null and account_id = $1 and question = $2
              and created_at > now() - make_interval(secs => $3)
            order by created_at desc limit 1
            for update skip locked`,
          [accountId, question, INTENT_WINDOW_SECONDS],
        );
        if (!row) return null;
        await tx.query('update platform_question_intents set session_id = $2 where id = $1', [
          row.id,
          sessionId,
        ]);
        return agentOf(tx);
      });
    } catch (error) {
      // Another worker or the API claimed a row for this session first.
      if (!isUniqueViolation(error)) throw error;
      return agentOf(this.db);
    }
  }

  /** The slug of the agent that ran a session, or null. */
  async agentOfSession(sessionId: string): Promise<string | null> {
    if (!isUuid(sessionId)) return null;
    const [row] = await this.db.query<{ slug: string }>(
      `select g.slug from platform_question_intents i
         join platform_agents g on g.id = i.agent_id where i.session_id = $1`,
      [sessionId],
    );
    return row?.slug ?? null;
  }
}

/**
 * The input of a root turn run with an agent (docs/platform/public-api.md,
 * step 4). Without an agent, the input does not change.
 */
export function agentInput(agent: IntentAgent | null, question: string): string {
  if (!agent) return question;
  return `Instructions from the agent "${agent.name}" (${agent.slug}):\n${agent.instructions}\n\nQuestion:\n${question}`;
}

export interface UsageTotals {
  readonly sessions: number;
  readonly cost: number;
  /** Median seconds from the root task's start to its end, over sessions at rest. */
  readonly medianSecondsToRest: number | null;
}

export interface AgentUsage extends UsageTotals {
  readonly slug: string;
}

// One row per session: its cost is every task's own cost summed (the same sum
// as the snapshot's spend), and its time is the root task's start to end.
// tasks.own_cost is where the kernel keeps what each task spent; the ledger
// holds the same amounts per account, not per session.
const SESSION_FIGURES = `
  (select coalesce(sum(t.own_cost), 0) from tasks t where t.session_id = s.id) as cost,
  (select extract(epoch from (r.ended_at - r.started_at))::double precision
     from tasks r where r.session_id = s.id and r.parent_id is null and r.ended_at is not null
     limit 1) as seconds`;

const TOTALS = `count(f.id)::int as sessions, coalesce(sum(f.cost), 0)::double precision as cost,
  percentile_cont(0.5) within group (order by f.seconds) as "medianSecondsToRest"`;

export class UsageStore {
  constructor(private readonly db: Queryable) {}

  /** Every session the account opened, through the API or the web app. */
  async asConsumer(accountId: string): Promise<UsageTotals> {
    const [row] = await this.db.query<UsageTotals>(
      `with f as (select s.id, ${SESSION_FIGURES} from sessions s where s.account_id = $1)
       select ${TOTALS} from f`,
      [accountId],
    );
    return row ?? { sessions: 0, cost: 0, medianSecondsToRest: null };
  }

  /** Each agent the account published, withdrawn ones included. All agents when no owner is given. */
  async byAgent(ownerAccountId?: string): Promise<(AgentUsage & { owner: string })[]> {
    const mine = ownerAccountId !== undefined;
    if (mine && !isUuid(ownerAccountId)) return [];
    return this.db.query<AgentUsage & { owner: string }>(
      `with f as (
         select s.id, i.agent_id, ${SESSION_FIGURES}
           from platform_question_intents i join sessions s on s.id = i.session_id
          where i.agent_id is not null)
       select g.slug, a.display_name as owner, ${TOTALS}
         from platform_agents g
         join accounts a on a.id = g.owner_account_id
         left join f on f.agent_id = g.id
        ${mine ? 'where g.owner_account_id = $1' : ''}
        group by g.id, a.display_name order by g.slug`,
      mine ? [ownerAccountId] : [],
    );
  }
}
