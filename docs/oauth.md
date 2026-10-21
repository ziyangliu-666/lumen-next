# GitHub and Google sign-in

Each provider is on when both of its variables are set:

| Variable | Value |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | A GitHub OAuth app |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | A Google web OAuth client |

Register these callback URLs with the provider, on the origin in `LUMEN_ORIGIN`:

- `<origin>/api/auth/github/callback`
- `<origin>/api/auth/google/callback`

The origin must be HTTPS. For local development, `http://localhost:4000` works
when `IDENTITY_INSECURE_COOKIES=true` and `NODE_ENV` is not `production`.

A provider sign-in with a verified email opens the account that has that
email. If nobody proved that email before, its password is removed, so a
person who registered someone else's email cannot keep access.

Both providers show their account picker each time.
