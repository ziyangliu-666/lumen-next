import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import type { ProjectService } from './projectService.js';
import { objectOf } from './validation.js';

export function projectRoutes(service: ProjectService): (app: FastifyInstance) => void {
  return (app) => {
    app.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      requireUser(request);
    });
    app.get('/api/projects', (request) => service.list(requireUser(request), request.query));
    app.post('/api/projects', async (request, reply) => {
      objectOf(request.query, []);
      const result = await service.create(requireUser(request), request.body);
      return reply
        .status(201)
        .header('Location', `/api/projects/${result.project.id}`)
        .send(result);
    });
    app.get<{ Params: { id: string } }>('/api/projects/:id', async (request) => {
      objectOf(request.query, []);
      return { item: await service.get(requireUser(request), request.params.id) };
    });
    app.post<{ Params: { id: string } }>('/api/projects/:id/stop', async (request, reply) => {
      objectOf(request.query, []);
      if (request.body !== undefined) objectOf(request.body, []);
      const result = await service.stop(requireUser(request), request.params.id);
      return reply.status(result.outcome === 'stop_requested' ? 202 : 200).send(result);
    });
    app.post<{ Params: { id: string } }>('/api/projects/:id/visit', async (request) => {
      objectOf(request.query, []);
      if (request.body !== undefined) objectOf(request.body, []);
      return service.visit(requireUser(request), request.params.id);
    });
    app.get<{ Params: { id: string } }>('/api/projects/:id/findings', (request) =>
      service.findings(requireUser(request), request.params.id, request.query),
    );
  };
}
