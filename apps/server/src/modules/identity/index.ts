// Public index for the identity slice. Owner: LU YI.
// SQL-backed password authentication is wired; optional providers are explicitly injected.
// Other slices never import this slice's internal files.
export {
  AbstractAuthFlow,
  AuthFailure,
  type AuthFailureCode,
  type AuthStrategy,
  type VerifiedPrincipal,
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
export { resendMailSender, type MailSender, type IdentityMail } from './mail.js';
export { MailWorker, type MailEvent } from './mailQueue.js';
export {
  OAuthStrategy,
  OAuthAccounts,
  OAuthAttempts,
  OAuthEmailConflict,
  type OAuthKind,
  type OAuthProvider,
  type OAuthProfile,
} from './oauth.js';
export {
  oauthProvidersFromEnvironment,
  type OAuthConfigurationOptions,
} from './oauthConfiguration.js';
export {
  githubProvider,
  googleProvider,
  type GitHubOAuthClient,
  type GoogleOAuthClient,
  type OAuthTokens,
} from './oauthProviders.js';
export {
  AdminAccountFailure,
  type AdminAccountFailureCode,
  type AccountSummary,
  type AdminAccounts,
} from './adminAccounts.js';
export {
  AccountFailure,
  type AccountFailureCode,
  type AccountStore,
  type ProfilePatch,
} from './accounts.js';
export { LoginGate, LoginLimited } from './loginGate.js';
export { type IdentityDatabase, type IdentitySql } from './identityDatabase.js';
export {
  postgresDatabase,
  type IdentityPgPool,
  type IdentityPgConnection,
} from './postgresDatabase.js';
export type { IdentityAuthentication } from './identityAuthentication.js';
export { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
export {
  createIdentitySlice,
  type IdentitySliceOptions,
  type IdentitySlice,
} from './createIdentitySlice.js';
export {
  identityRoutes,
  type IdentityRouteDeps,
  type AccountReader,
  type AccountView,
} from './routes.js';
