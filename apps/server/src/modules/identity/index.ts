// Public index for the identity slice. Owner: LU YI.
// Routes and resolver building blocks are not wired into main.ts yet.
// Other slices never import this slice's internal files.
export {
  AbstractAuthFlow,
  AuthFailure,
  type AuthFailureCode,
  type AuthStrategy,
} from './authFlow.js';
export {
  PasswordStrategy,
  type PasswordAccount,
  type PasswordAccountStore,
} from './passwordStrategy.js';
export {
  AuthSessions,
  type AuthSessionStore,
  type NewAuthSession,
  type StoredAuthSession,
  type IssuedAuthSession,
} from './authSessions.js';
export { AUTH_COOKIE, SessionStrategy, SessionPrincipalResolver } from './sessionStrategy.js';
export { SessionAuthFlow } from './sessionAuthFlow.js';
export { AccountService } from './accountService.js';
export {
  AccountFailure,
  type AccountFailureCode,
  type AccountStore,
  type ProfilePatch,
} from './accounts.js';
export { LoginGate, LoginLimited } from './loginGate.js';
export {
  identityRoutes,
  type IdentityRouteDeps,
  type AccountReader,
  type AccountView,
} from './routes.js';
