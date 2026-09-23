# Arctic maintenance review

Owner: LU YI. Reviewed 2026-09-23 against main `2613a84`.

## Finding

Arctic, the OAuth client library pinned at 3.7.0, was deprecated upstream in
July 2026. The repository README says so and points to replacement example code
under `/code`; npm reports 3.7.0 as "no longer supported". No further releases,
including security fixes, should be expected.

`npm audit --omit=dev` reports 0 vulnerabilities today, and the CI dependency
audit passed on PR #34. Deprecation is therefore a maintenance risk, not a known
vulnerability.

## Exposure in this slice

The dependency is small and already isolated:

- One import, in `oauthConfiguration.ts`: two constructors, `GitHub` and `Google`.
- Three calls, all behind structural ports in `oauthProviders.ts`
  (`GitHubOAuthClient`, `GoogleOAuthClient`, `OAuthTokens`):
  `createAuthorizationURL`, `validateAuthorizationCode` and `accessToken()`.
- Profile lookup, state and verifier cookies, timeouts and session issuance are
  our own code, not Arctic's.
- Arctic's own dependencies are `@oslojs/crypto`, `@oslojs/encoding` and
  `@oslojs/jwt`.

The ports mean a replacement changes the two constructors and nothing else.

## Options

| Option | Cost | Risk |
| --- | --- | --- |
| Keep 3.7.0 pinned | None now | Unpatched if an issue is found; the npm warning stays in every install |
| Replace with in-slice clients over `fetch` | About 100 lines: authorization URL and code exchange for GitHub, plus PKCE S256 for Google, following Arctic's `/code` examples | Code we own; covered by the existing port tests plus new exchange tests |
| Adopt `openid-client` | New server dependency, needs core-owner review | Maintained and certified, but larger than the three calls we need |

## Recommendation

Keep 3.7.0 for local and staging acceptance; nothing is broken today. Before
OAuth is enabled on a public deployment, replace Arctic with in-slice clients
that implement the existing ports, in a focused identity PR with tests for:

- the authorization URL: parameters, state, and S256 challenge for Google;
- the token exchange: success, provider error, non-JSON body, and timeout;
- the verifier being required for Google and absent for GitHub.

GitHub PKCE must still not be claimed unless the new client sends a challenge
and GitHub verifies it.
