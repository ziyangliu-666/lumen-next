import type { FastifyPluginAsync } from 'fastify';
import { requireStaff } from '../../core/http/authGuard.js';

/** Local/test authorization probe, not a billing admin API or public slice export. */
export const localRoleProbe: FastifyPluginAsync = (app): Promise<void> => {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('The role probe is for local development only');
  }
  app.get('/api/local/staff-check', (request, reply) => {
    void reply.header('Cache-Control', 'no-store');
    const principal = requireStaff(request);
    return { accountId: principal.accountId, role: principal.role, localOnly: true };
  });
  return Promise.resolve();
};
