# Sign-in, sign-up and account panels

Owner: LU YI. `#/signin` uses shared shell/UI controls and theme classes.
`authClient.ts` calls same-origin JSON endpoints without storing session tokens.
Pending requests disable controls, duplicate submits are guarded, and passwords
are cleared after attempts. Signup requires 8 Unicode code points. Users go to
`#/home`; staff go to `#/admin`, protected by shell StaffGuard.

AccountActions provides shell-injected Account and Sign out controls. Successful
signup/password login also refreshes the shared account hook, so a persistent
header updates without a reload. `main.tsx` passes it to the shell's
`accountActions` slot.

AccountSettings is mounted by `main.tsx` in the Settings Account tab
(`#/settings/account`), reached from the header's Account link. It uses the shared
account hook to guard AccountPanel, with loading, retry, signed-out and stub states.
AccountPanel supports profile/password changes and signout-one/all. Successful
mutations announce the existing shared auth event; refresh temporarily disables
the editor without discarding success feedback. A password change revokes other
sessions. Deletion is deliberately absent. No cross-page imports. See
[the integration notes](../../../../../docs/identity/ACCOUNT_INTEGRATION.md).

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
