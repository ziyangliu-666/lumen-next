# Sign-in, sign-up and account panels

Owner: LU YI. `#/signin` uses shared shell/UI controls and theme classes.
`authClient.ts` calls same-origin JSON endpoints without storing session tokens.
Pending requests disable controls, duplicate submits are guarded, and passwords
are cleared after attempts. Signup requires 8 Unicode code points. Users go to
`#/home`; staff go to `#/admin`, protected by shell StaffGuard.

AccountActions provides shell-injected controls: the account avatar (initials of
the display name) with the name beside it, which opens a menu with Projects,
Settings, Admin (staff only) and Sign out. A development account signs out by
dropping its cookie; it never calls the session signout route. Successful
signup/password login also refreshes the shared account hook, so a persistent
header updates without a reload. `main.tsx` passes it to the shell's
`accountActions` slot.

AccountSettings is mounted by `main.tsx` in the Settings Account tab
(`#/settings/account`), reached from Settings in the account menu. It uses the shared
account hook to guard AccountPanel, with loading, retry, signed-out and stub states.
AccountPanel supports profile/password changes and signout-one/all. Successful
mutations announce the existing shared auth event; refresh temporarily disables
the editor without discarding success feedback. A password change revokes other
sessions. DeleteAccountSection asks for the current password (empty for a
provider-only account that signed in within 10 minutes), confirms in an
AlertDialog, calls `DELETE /api/me` and then leaves for `#/signin`. No
cross-page imports. See
[the integration notes](../../../../../docs/identity/ACCOUNT_INTEGRATION.md).

On a server without an account database (`/api/me` answers 404) the page says
so first and offers the development account instead of forms that cannot work.

The sign-in page is one focused column: a single heading, the configured
providers, an "or use email" divider, the email form with one primary action, and
the sign-up switch as a text link. Account profile/password controls reflow rather
than relying on browser zoom; long/error states may scroll normally.

ProviderSignIn uses `/api/auth/providers`. With no provider configured it renders
nothing, so the page advertises no dead buttons. When only one is configured, the
other is shown disabled and named as unconfigured. Loading and a failed lookup are
distinct, and only a failed lookup offers "Try again".
"Forgot password?" appears next to the password field only when `/api/auth/mail`
reports mail enabled; RecoveryPanel then handles the one-time code.

The normal monolith now mounts password authentication with DATABASE_URL. See
[API](../../../../../docs/identity/API.md) and
[local setup](../../../../../docs/identity/LOCAL_AUTH.md). Database-backed runs
reject stub credentials. Repository verify lints/typechecks the web page;
browser acceptance must additionally exercise the real server and cookie flow.


### Remove an OpenAI key without signing in

The sign-in page offers an explicit action-specific removal panel. Password
removal submits fresh email/password proof, clears the password before sending,
and does not dispatch an authentication-state change or navigate to a signed-in
page. OAuth removal buttons are offered only for configured providers, POST
explicit confirmation, validate the returned HTTPS provider origin, then
navigate. The callback success/failure query renders removal feedback, never
login authority. No owner ID or return destination is accepted from the user.

This supports suspended owners without restoring their account. The normal
sign-in and account deletion flows remain separate. Local browser verification
covered synthetic password removal while remaining signed out; live OAuth
provider acceptance still requires staging configuration and an owner walkthrough.
