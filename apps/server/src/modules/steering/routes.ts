import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest, notFound } from '../../core/http/httpError.js';
import { SandboxFs, SandboxPathError, type Scope } from './sandboxFs.js';

// The files panel's two routes, per docs/ARCHITECTURE.md §7. Both are project-
// scoped, not session-scoped: they only ever address `upload` and `output`
// (SandboxFs.list/readFile refuse `workspace` with no session id — see
// sandboxFs.ts), because a running sandbox's scratch space is not this
// endpoint's job. Thin handlers, like session's routes.ts: ownership and path
// safety are decided one layer down, never re-decided here.

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

export function steeringRoutes(
  volumeRoot: string,
  makeFs: (projectId: string) => SandboxFs = (projectId) => new SandboxFs(volumeRoot, projectId),
): (app: FastifyInstance) => void {
  return (app) => {
    // The project id is taken on trust in Sprint 1: there is no project store
    // to ask. Projects' `projectOf` closes that when it lands — same gap
    // session's routes.ts documents for its own :id param.
    app.get<{ Params: { id: string }; Querystring: { scope?: string; path?: string } }>(
      '/api/projects/:id/files',
      async (request) => {
        requireUser(request);
        const scope = scopeOf(request.query);
        const path = pathOf(request.query);
        try {
          const sandbox = makeFs(request.params.id);
          return await sandbox.list(`/mnt/${scope}${path}`);
        } catch (error) {
          throw asHttpError(error);
        }
      },
    );

    app.get<{ Params: { id: string; '*': string } }>(
      '/api/projects/:id/files/*',
      async (request, reply) => {
        requireUser(request);
        try {
          const sandbox = makeFs(request.params.id);
          const data = await sandbox.readFile(`/mnt/${request.params['*']}`);
          return await reply.type('application/octet-stream').send(data);
        } catch (error) {
          throw asHttpError(error);
        }
      },
    );
  };
}
