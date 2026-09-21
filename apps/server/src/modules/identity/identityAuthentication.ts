import type { FastifyPluginAsync } from 'fastify';
import type { PrincipalResolver } from '../../core/http/authGuard.js';

/**
 * Authentication surface consumed by the composition root, without billing's
 * account-administration capabilities. Implemented by createIdentitySlice.
 * Other slices consume request.principal through core's requireUser instead of
 * parsing cookies or querying an account to authenticate a request.
 */
export interface IdentityAuthentication {
  readonly principalResolver: PrincipalResolver;
  readonly registerRoutes: FastifyPluginAsync;
}
