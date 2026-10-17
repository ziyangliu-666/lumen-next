import type { StepDetail, Task } from '@lumen/contracts';
import type { Worker, WorkerReport } from '../../core/domain/worker.js';
import {
  nullModel,
  withLog,
  type Message,
  type ModelProvider,
  type Tool,
  type ToolCall,
} from '../../core/model/index.js';
import { compute } from './compute.js';
import { SandboxFs, SandboxPathError, SandboxQuotaError } from './sandboxFs.js';
import { search, SEARCH_SOURCES, type SearchSource } from './search.js';
import type { SteerQueue } from './steerCommand.js';
import type { SteerRegistry } from './steerRegistry.js';

// The agent loop behind the Worker interface (docs/ARCHITECTURE.md §6). Every
// task, lead or reader, is one conversation with the model: ask it, run the
// tools it called, hand it what they returned, and ask again, until it answers
// in plain text. What differs between the two agents is only the prompt and
// the tools: a lead plans and delegates, a reader runs commands and reads and
// writes files in its session's sandbox.
//
// A steer reaches the conversation at a step boundary, and every model call is
// one: before each call, whatever the user said since the last one is written
// to the trace as a 'you' step and added to the conversation as their message.
// A turn does not end while a steer is waiting; the model hears it first.

const DEFAULT_TIMEOUT_MS = 30_000;
/** Model calls one turn may make. A loop that has not answered by now will not. */
const MAX_ROUNDS = 12;
/** Every request has a cap; reasoning models spend part of it before they write a word. */
// Room for an answer with a table in it. At 4,000 a lead with a long reply
// was cut off mid-sentence and the page showed nothing.
const MAX_TOKENS = 8_000;
/** How much of a tool's result the model is shown. The trace keeps its own, shorter cut. */
const MAX_TOOL_RESULT_CHARS = 8_000;
/** Readers one delegate call may open. The kernel bounds depth and concurrency on its own. */
const MAX_READERS_PER_CALL = 5;

const FILES =
  'Files live under /mnt: /mnt/upload holds what the user uploaded (read only), /mnt/workspace is scratch space for this session, /mnt/output is for results the user should keep. Save each table, dataset or proof sketch worth keeping to /mnt/output; the user sees that folder first.';

// The prompts carry the habits a research lead needs and a small model does
// not bring on its own. Each line answers a failure seen on staging:
// - asked the user to upload data for a question it could compute;
// - opened one reader per call, one after another, for steps of one task;
// - said a file was saved when no command had run, because the sandbox had
//   no compute;
// - read "Free exploration" as a question to clarify.
const LEAD_PROMPT = [
  'You are the lead agent of Lumen, a research agent for mathematics. You find out what is true and say so with the evidence.',
  'Work, do not ask. If the question can be settled by reading, searching or computing, do that instead of asking the user for data or permission. Ask only when the question itself is ambiguous.',
  'If the message is "Free exploration" or names only an area, choose one specific, open question in that area yourself, say which and why in one sentence, and pursue it.',
  'Look in /mnt/upload only when the user mentions something they attached; it is empty otherwise.',
  'Back the answer with something computed whenever the question allows it: a count, a check, a table. A survey of abstracts is a start, not an answer.',
  'Before computing, find out what is known: search OEIS for the sequences involved and arXiv for the topic. A result that is already published is worth saying, not rediscovering.',
  'Delegate work that needs commands run or many files read to readers. Each reader sees only its task title, so make every title self-contained: what to compute or find, the exact definitions, and what to report back. Put independent tasks in ONE delegate call so they run in parallel; do not split one task into sequential steps across readers.',
  'Report only what tool results show. If a command could not run or a file is not there, say so plainly and do not claim it. Separate what you verified from what you recall.',
  FILES,
  'The user may speak while you work; their words arrive as user messages. Follow them.',
  'When you have the answer, reply in plain text without calling a tool: the result first, then the evidence, then what is still open. Keep it under 400 words; never enumerate cases by hand in a reply, delegate that.',
].join('\n');

const READER_PROMPT = [
  'You are a reader agent of Lumen. Your task is the first user message; do it and nothing else.',
  'Use run to execute shell commands in a sandbox (Alpine Linux with Python 3, working directory /mnt/workspace, no network).',
  FILES,
  'The sandbox has no network; use search for OEIS and arXiv. Check computed sequences against OEIS before reporting them as new.',
  'Keep each result worth keeping with record_finding, one fact per call, with the numbers that support it.',
  'Report only what your commands actually returned. If a command fails or cannot run, say that, with its error, and stop; never invent output.',
  'The user may speak while you work; their words arrive as user messages. Follow them.',
  'Finish with a short plain-text reply saying what you found, without calling a tool.',
].join('\n');

const PATH = { type: 'string', description: 'An absolute path under /mnt.' };

const TOOLS = {
  delegate: {
    name: 'delegate',
    description: `Hand work to readers, at most ${MAX_READERS_PER_CALL} per call, and wait for all of them. Returns each reader's final answer.`,
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: { type: 'string', description: "One reader's self-contained task." },
        },
      },
      required: ['tasks'],
    },
  },
  run: {
    name: 'run',
    description: 'Run one shell command in the sandbox. Returns its exit code and output.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
  },
  list_files: {
    name: 'list_files',
    description: 'List a directory under /mnt.',
    parameters: { type: 'object', properties: { path: PATH }, required: ['path'] },
  },
  read_file: {
    name: 'read_file',
    description: 'Read a text file under /mnt.',
    parameters: { type: 'object', properties: { path: PATH }, required: ['path'] },
  },
  write_file: {
    name: 'write_file',
    description:
      'Write a text file under /mnt/workspace or /mnt/output, replacing it if it exists.',
    parameters: {
      type: 'object',
      properties: { path: PATH, content: { type: 'string' } },
      required: ['path', 'content'],
    },
  },
  search: {
    name: 'search',
    description:
      'Search the literature: "oeis" for integer sequences (give terms such as 1,2,5,14,42 or words), "arxiv" for papers (give words). Returns the top matches. Use it before computing, to learn what is already known, and after, to check a sequence.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: [...SEARCH_SOURCES] },
        query: { type: 'string' },
      },
      required: ['source', 'query'],
    },
  },
  record_finding: {
    name: 'record_finding',
    description: 'Keep one result: a fact the user should see among the session findings.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
} satisfies Record<string, Tool>;

const LEAD_TOOLS: readonly Tool[] = [
  TOOLS.search,
  TOOLS.delegate,
  TOOLS.list_files,
  TOOLS.read_file,
];
const READER_TOOLS: readonly Tool[] = [
  TOOLS.search,
  TOOLS.run,
  TOOLS.list_files,
  TOOLS.read_file,
  TOOLS.write_file,
  TOOLS.record_finding,
];

export interface WorkerOptions {
  readonly volumeRoot: string;
  /** From the session slice's own SessionDirectory: which project a session belongs to. */
  readonly context: (
    sessionId: string,
  ) => Promise<{ readonly projectId: string; readonly accountId: string } | null>;
  readonly registry: SteerRegistry;
  /** Who does the thinking. Defaults to the model that does nothing, which answers at once. */
  readonly model?: ModelProvider;
  /** Which Compute a reader's command runs against. Defaults to 'none': no Docker required to develop against this worker. */
  readonly provider?: 'docker' | 'none';
  readonly timeoutMs?: number;
  /** The literature connectors' HTTP client; tests pass a fake. */
  readonly fetch?: Parameters<typeof search>[2];
}

/** A tool call the model got wrong: said back to the model, never thrown out of the turn. */
class ToolRefusal extends Error {}

function stringArg(call: ToolCall, name: string): string {
  const value = call.arguments[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ToolRefusal(`${call.name} needs "${name}" as a non-empty string`);
  }
  return value;
}

/**
 * A path the model got wrong after the sandbox let it through: a directory
 * read as a file, a file that is not there, a file used as a directory. The
 * model can fix these; the server has not failed.
 */
const PATH_MISTAKES = new Set(['EISDIR', 'ENOENT', 'ENOTDIR', 'EEXIST', 'ENOTEMPTY']);
function isPathMistake(error: unknown): error is Error {
  return (
    error instanceof Error &&
    typeof (error as NodeJS.ErrnoException).code === 'string' &&
    PATH_MISTAKES.has((error as NodeJS.ErrnoException).code!)
  );
}

function clip(text: string, limit = MAX_TOOL_RESULT_CHARS): string {
  return text.length <= limit
    ? text
    : `${text.slice(0, limit)}\n… (${text.length - limit} more characters cut)`;
}

export function createWorker(options: WorkerOptions): Worker {
  const provider = options.provider ?? 'none';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = options.model ?? nullModel;
  // A reader's final answer, kept until its lead's delegate call reads it: the
  // kernel hands a lead its children as tasks, and a task carries a status,
  // not what the reader concluded.
  const answers = new Map<string, string>();

  /** One task's turn: its conversation, its steers, and the tools it may call. */
  class Turn {
    readonly messages: Message[];
    /** Steers the queue has applied and the conversation has not yet taken in. */
    readonly inbox: string[] = [];
    readonly queue: SteerQueue;
    private sandbox: Promise<SandboxFs | null> | undefined;

    constructor(
      readonly task: Task,
      input: string,
      readonly report: WorkerReport,
    ) {
      this.messages = [{ role: 'user', content: input }];
      this.queue = options.registry.begin(task.id, (text) => this.inbox.push(text));
    }

    get isLead(): boolean {
      return this.task.agent === 'lead';
    }

    /**
     * Takes the steers due at these moments off the queue into the inbox,
     * without writing anything yet. True when the inbox holds any.
     */
    collect(...moments: readonly ('next-step' | 'end-of-turn')[]): boolean {
      for (const moment of moments) this.queue.flush(moment);
      return this.inbox.length > 0;
    }

    /**
     * Moves the steers due at these moments into the conversation, in the
     * order they were sent: each is a 'you' step in the trace, awaited, and
     * then the user's next message.
     */
    async land(...moments: readonly ('next-step' | 'end-of-turn')[]): Promise<void> {
      this.collect(...moments);
      for (const text of this.inbox.splice(0)) {
        await this.report.appendStep(this.task.id, 'you', text);
        this.messages.push({ role: 'user', content: text });
      }
    }

    /** The session's sandbox, looked up once, and only when a tool first needs it. */
    files(): Promise<SandboxFs | null> {
      this.sandbox ??= options.context(this.task.sessionId).then(async (context) => {
        if (!context) return null;
        const sandbox = new SandboxFs(options.volumeRoot, context.projectId, this.task.sessionId);
        await sandbox.ensureDirectories();
        return sandbox;
      });
      return this.sandbox;
    }

    async requireFiles(): Promise<SandboxFs> {
      const sandbox = await this.files();
      if (!sandbox) throw new ToolRefusal('this session belongs to no project, so it has no files');
      return sandbox;
    }

    /** A tool step on the trace: what ran, how long, what came back. */
    async traced(text: string, tool: string, startedAt: number, output: string): Promise<void> {
      const detail: StepDetail = {
        tool,
        durationMs: Date.now() - startedAt,
        output: output || '(no output)',
      };
      await this.report.appendStep(this.task.id, 'tool', text, detail);
    }

    /** Runs one call. What it returns is what the model reads back; a refusal is returned too. */
    async call(call: ToolCall): Promise<string> {
      const allowed = this.isLead ? LEAD_TOOLS : READER_TOOLS;
      const startedAt = Date.now();
      try {
        if (!allowed.some((tool) => tool.name === call.name)) {
          throw new ToolRefusal(`there is no tool called ${call.name}`);
        }
        return await this.dispatch(call, startedAt);
      } catch (error) {
        // A wrong path, a quota, a missing argument: the model's to fix, so it
        // hears why and the turn goes on. Anything else is this server's
        // failure, and ends the turn as one.
        const refusal =
          error instanceof ToolRefusal ||
          error instanceof SandboxPathError ||
          error instanceof SandboxQuotaError ||
          isPathMistake(error);
        if (!refusal) throw error;
        const message = `error: ${error.message}`;
        await this.traced(`${call.name}: refused`, call.name, startedAt, message);
        return message;
      }
    }

    private async dispatch(call: ToolCall, startedAt: number): Promise<string> {
      switch (call.name) {
        case 'delegate':
          return this.delegate(call);
        case 'search': {
          const source = stringArg(call, 'source');
          if (!(SEARCH_SOURCES as readonly string[]).includes(source)) {
            throw new ToolRefusal(`search source must be one of ${SEARCH_SOURCES.join(', ')}`);
          }
          const query = stringArg(call, 'query');
          let result;
          try {
            result = await search(source as SearchSource, query, options.fetch);
          } catch (error) {
            // A source that is down is a result, not a crash: the agent hears
            // it and says so, and the page shows the row that failed.
            const why = error instanceof Error ? error.message : String(error);
            result = {
              rows: [{ source, text: query, result: 'Unavailable', empty: true }],
              text: `${source} search failed: ${why}`,
            };
          }
          this.report.log.info({ tool: 'search', source, rows: result.rows.length }, 'search');
          await this.report.appendStep(this.task.id, 'tool', `search ${source}: ${query}`, {
            tool: 'search',
            durationMs: Date.now() - startedAt,
            rows: result.rows,
          });
          return clip(result.text);
        }
        case 'run': {
          const command = stringArg(call, 'command');
          const sandbox = await this.requireFiles();
          const result = await compute(provider, sandbox.hostMounts).run(command, {
            cwd: '/mnt/workspace',
            timeoutMs,
          });
          this.report.log.info(
            {
              tool: 'run',
              provider,
              exitCode: result.exitCode,
              durationMs: Date.now() - startedAt,
            },
            'compute run',
          );
          const output = [result.stdout, result.stderr]
            .filter((part) => part.length > 0)
            .join('\n')
            .trim();
          await this.traced(`run: ${command}`, 'run', startedAt, output);
          return clip(`exit ${result.exitCode}\n${output}`);
        }
        case 'list_files': {
          const path = stringArg(call, 'path');
          const entries = await (await this.requireFiles()).list(path);
          const listing = entries
            .map(
              (entry) =>
                `${entry.kind === 'directory' ? 'dir ' : 'file'} ${entry.sizeBytes}\t${entry.virtualPath}`,
            )
            .join('\n');
          await this.traced(`list: ${path}`, 'list', startedAt, listing || '(empty)');
          return clip(listing || '(empty directory)');
        }
        case 'read_file': {
          const path = stringArg(call, 'path');
          const text = (await (await this.requireFiles()).readFile(path)).toString('utf8');
          await this.traced(`read: ${path}`, 'read', startedAt, text);
          return clip(text);
        }
        case 'write_file': {
          const path = stringArg(call, 'path');
          const content = call.arguments['content'];
          if (typeof content !== 'string')
            throw new ToolRefusal('write_file needs "content" as a string');
          await (await this.requireFiles()).writeFile(path, Buffer.from(content, 'utf8'));
          await this.traced(
            `save: ${path}`,
            'save',
            startedAt,
            `${Buffer.byteLength(content)} bytes`,
          );
          return `wrote ${path}`;
        }
        case 'record_finding': {
          await this.report.recordFinding(this.task.id, stringArg(call, 'text'));
          return 'recorded';
        }
        default:
          throw new ToolRefusal(`there is no tool called ${call.name}`);
      }
    }

    private async delegate(call: ToolCall): Promise<string> {
      const raw = call.arguments['tasks'];
      const titles = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        : [];
      if (titles.length === 0)
        throw new ToolRefusal('delegate needs "tasks": a list of task titles');
      if (titles.length > MAX_READERS_PER_CALL) {
        throw new ToolRefusal(`delegate takes at most ${MAX_READERS_PER_CALL} tasks per call`);
      }
      // delegate() writes the delegate step itself, and resolves once every
      // reader has come to rest. Steers sent to the lead meanwhile wait in its
      // queue and land before its next model call.
      const children = await this.report.delegate(
        this.task.id,
        titles.map((title) => ({ agent: 'reader', title })),
      );
      return children
        .map((child) => {
          const answer = answers.get(child.id) ?? '(no answer)';
          answers.delete(child.id);
          return `## ${child.title}\nstatus: ${child.status}\n${answer}`;
        })
        .join('\n\n');
    }
  }

  async function converse(turn: Turn): Promise<string> {
    const tools = turn.isLead ? LEAD_TOOLS : READER_TOOLS;
    let retold = false;
    let partial = '';
    for (let round = 0; round < MAX_ROUNDS; round++) {
      await turn.land('next-step');
      // Logged with the task's ids: model, tokens, cost, duration, never the text.
      const completion = await withLog(model, turn.report.log).complete({
        system: turn.isLead ? LEAD_PROMPT : READER_PROMPT,
        messages: turn.messages,
        tools,
        maxTokens: MAX_TOKENS,
      });
      const receipt: StepDetail = {
        tool: model.name,
        durationMs: completion.durationMs,
        cost: completion.cost,
      };

      // A reply cut off at the length limit is not an answer: on staging a
      // lead tried to enumerate a table by hand, ran out of room, and the page
      // showed an empty reply. It is asked once for the short version.
      if (completion.toolCalls.length === 0 && completion.stopReason === 'length' && !retold) {
        retold = true;
        partial = completion.text;
        await turn.report.appendStep(
          turn.task.id,
          'thinking',
          'The reply ran past the length limit; asking for the short version.',
          receipt,
        );
        turn.messages.push({ role: 'assistant', content: completion.text });
        turn.messages.push({
          role: 'user',
          content: turn.isLead
            ? 'Your reply was cut off at the length limit. If the answer still needs computing, call delegate now with that computation instead of writing it out. Otherwise answer again in at most 300 words: the result, the evidence, what is open.'
            : 'Your reply was cut off at the length limit. Answer again in at most 300 words: what you ran, what it returned, what you recorded.',
        });
        continue;
      }

      if (completion.toolCalls.length === 0) {
        turn.messages.push({ role: 'assistant', content: completion.text });
        // The model would stop here. Anything the user said meanwhile, or
        // asked to hear at the end of the turn, it hears first, and what it
        // wrote becomes thinking on the way to the answer rather than the answer.
        if (turn.collect('next-step', 'end-of-turn')) {
          await turn.report.appendStep(
            turn.task.id,
            'thinking',
            completion.text || '(nothing said)',
            receipt,
          );
          await turn.land();
          continue;
        }
        const cut = completion.stopReason === 'length';
        const written = completion.text || (cut ? partial : '');
        const answer = written
          ? cut
            ? `${written}\n\n(The reply was cut off here, at the length limit.)`
            : written
          : 'lumen ended this turn without an answer.';
        await turn.report.appendStep(turn.task.id, 'reply', answer, receipt);
        return answer;
      }

      if (completion.text) {
        await turn.report.appendStep(turn.task.id, 'thinking', completion.text, receipt);
      } else if (completion.cost.dollars > 0) {
        // A call that only asked for tools still cost something; it has no
        // step of its own to carry the receipt.
        await turn.report.addSpend(turn.task.id, completion.cost, `model: ${completion.model}`);
      }
      turn.messages.push({
        role: 'assistant',
        content: completion.text,
        toolCalls: completion.toolCalls,
      });
      for (const call of completion.toolCalls) {
        turn.messages.push({ role: 'tool', toolCallId: call.id, content: await turn.call(call) });
      }
    }
    const answer = `Stopped after ${MAX_ROUNDS} model calls without reaching an answer.`;
    await turn.report.appendStep(turn.task.id, 'reply', answer);
    return answer;
  }

  return {
    async run(task, input, report) {
      const turn = new Turn(task, input, report);
      try {
        const answer = await converse(turn);
        if (!turn.isLead) answers.set(task.id, answer);
      } catch (error) {
        // Throwing marks the task failed; the trace should also say why, in
        // words, where the user is already looking.
        const why = error instanceof Error ? error.message : String(error);
        await report.appendStep(task.id, 'reply', `Stopped: ${why}`).catch(() => undefined);
        throw error;
      } finally {
        // From here task.steer refuses this task. A steer that got in before
        // that and was never reached still belongs in the trace, not nowhere.
        options.registry.end(task.id);
        await turn.land('next-step', 'end-of-turn').catch(() => undefined);
      }
    },
  };
}
