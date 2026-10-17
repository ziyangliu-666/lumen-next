import type { FastifyInstance } from 'fastify';
import { requireUser, type Principal } from '../../core/http/authGuard.js';
import { badRequest, HttpError, notFound } from '../../core/http/httpError.js';
import { SandboxFs, SandboxPathError, SandboxQuotaError, type Scope } from './sandboxFs.js';

// The files panel's two routes, per docs/ARCHITECTURE.md §7. Both are project-
// scoped, not session-scoped: they only ever address `upload` and `output`
// (SandboxFs.list/readFile refuse `workspace` with no session id — see
// sandboxFs.ts), because a running sandbox's scratch space is not this
// endpoint's job. Thin handlers, like session's routes.ts: ownership and path
// safety are decided one layer down, never re-decided here.

/**
 * Same shape as session's own `ProjectGate`: resolves when `principal` may
 * touch `projectId`, rejects (or throws) otherwise. Optional so a test can
 * build these routes without a projects slice; app.ts always supplies
 * `projects.requireProject`.
 */
export type ProjectGate = (principal: Principal, projectId: string) => Promise<unknown>;

const SCOPES: readonly Scope[] = ['upload', 'output'];

function isScope(value: unknown): value is Scope {
  return value === 'upload' || value === 'output';
}

/** `?scope=upload|output`, defaulting to `upload` — the files a user attached. */
function scopeOf(query: unknown): Scope {
  const raw = (query as { scope?: unknown } | null)?.scope;
  if (raw === undefined) return 'upload';
  if (!isScope(raw)) throw badRequest(`scope must be one of ${SCOPES.join(', ')}`);
  return raw;
}

/** `?path=/reports` — one directory below the scope root; `/` (the default) is the scope root itself. */
function pathOf(query: unknown): string {
  const raw = (query as { path?: unknown } | null)?.path;
  if (raw === undefined) return '';
  if (typeof raw !== 'string') throw badRequest('path must be a string');
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function isNoEnt(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT'
  );
}

/**
 * One answer for "this path was refused as unsafe" and "this path genuinely
 * does not exist" — anything else would let a caller tell the two apart, and
 * neither is this route's business to explain.
 */
function asHttpError(error: unknown): unknown {
  return error instanceof SandboxPathError || isNoEnt(error) ? notFound('no such file') : error;
}

/** Files the browser shows as plain text rather than downloads. */
const TEXT_FILE = /\.(txt|csv|tsv|md|py|json|tex|log|sage|gp|m|jl|out)$/i;

/** The largest file a person may attach. The sandbox's per-file cap still applies. */
const UPLOAD_LIMIT = 10 * 1024 * 1024;

export function steeringRoutes(
  volumeRoot: string,
  requireProject?: ProjectGate,
  makeFs: (projectId: string) => SandboxFs = (projectId) => new SandboxFs(volumeRoot, projectId),
): (app: FastifyInstance) => void {
  return (app) => {
    app.get<{ Params: { id: string }; Querystring: { scope?: string; path?: string } }>(
      '/api/projects/:id/files',
      async (request) => {
        const principal = requireUser(request);
        const scope = scopeOf(request.query);
        const path = pathOf(request.query);
        try {
          // Validate first, authorise second, touch disk last — same order
          // session's routes.ts uses, for the same reason: a refused request
          // should not have to explain what it would have found.
          await requireProject?.(principal, request.params.id);
          const sandbox = makeFs(request.params.id);
          return await sandbox.list(`/mnt/${scope}${path}`);
        } catch (error) {
          throw asHttpError(error);
        }
      },
    );

    // An attachment: the request body is the file, its name is in the path.
    // Raw bytes, not multipart, so the route needs no form parser. Larger
    // than the server's 1 MB default, which a paper's PDF passes.
    app.register((scope, _options, done) => {
      scope.addContentTypeParser(
        'application/octet-stream',
        { parseAs: 'buffer', bodyLimit: UPLOAD_LIMIT },
        (_request, body, next) => next(null, body),
      );
      scope.put<{ Params: { id: string; name: string }; Body: Buffer }>(
        '/api/projects/:id/upload/:name',
        { bodyLimit: UPLOAD_LIMIT },
        async (request, reply) => {
          const principal = requireUser(request);
          if (!Buffer.isBuffer(request.body))
            throw badRequest('send the file as application/octet-stream');
          try {
            await requireProject?.(principal, request.params.id);
            const path = await makeFs(request.params.id).saveUpload(
              request.params.name,
              request.body,
            );
            return await reply.code(201).send({ path });
          } catch (error) {
            if (error instanceof SandboxQuotaError) throw new HttpError(413, error.message);
            if (error instanceof SandboxPathError) throw badRequest(error.message);
            throw error;
          }
        },
      );
      done();
    });

    app.get<{ Params: { id: string; '*': string } }>(
      '/api/projects/:id/files/*',
      async (request, reply) => {
        const principal = requireUser(request);
        try {
          await requireProject?.(principal, request.params.id);
          const sandbox = makeFs(request.params.id);
          const path = request.params['*'];
          const data = await sandbox.readFile(`/mnt/${path}`);
          // Text opens in the tab as plain text: the panel's link was a
          // download of every table and script. Never as HTML, so a file an
          // agent wrote cannot run as a page on this origin; nosniff keeps
          // the browser from guessing otherwise.
          const text = TEXT_FILE.test(path);
          return await reply
            .type(text ? 'text/plain; charset=utf-8' : 'application/octet-stream')
            .header('x-content-type-options', 'nosniff')
            .header('content-disposition', text ? 'inline' : 'attachment')
            .send(data);
        } catch (error) {
          throw asHttpError(error);
        }
      },
    );
  };
}
