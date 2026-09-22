# Sign-in, sign-up and account panels

Owner: LU YI. `#/signin` uses shared shell/UI controls and theme classes.
`authClient.ts` calls same-origin JSON endpoints without storing session tokens.
Pending requests disable controls, duplicate submits are guarded, and passwords
are cleared after attempts. Signup requires 8 Unicode code points. Users go to
`#/home`; staff go to `#/admin`, protected by shell StaffGuard.

AccountActions provides shell-injected Account and Sign out controls. Successful
signup/password login also refreshes the shared account hook, so a persistent
header updates without a reload. Canonical navigation wiring is supplied as an
owner-review patch and has been exercised in the local integration preview.

AccountSettings is reachable through Manage signed-in account. It uses the shared
account hook to guard AccountPanel, with loading, retry, signed-out and stub states.
AccountPanel supports profile/password changes and signout-one/all. Successful
mutations announce the existing shared auth event; refresh temporarily disables
the editor without discarding success feedback. A password change revokes other
sessions. Deletion is deliberately absent. Canonical Settings composition still
requires shell and Settings owner review; no cross-page imports were added. See
[the integration handoff](../../../../../docs/identity/ACCOUNT_INTEGRATION.md).

The sign-in card uses two columns on desktop and stacks on narrow screens.
Account profile/password controls also reflow rather than relying on browser zoom.
Controls keep their normal text/input sizes; long/error states may scroll normally.

OAuth buttons use `/api/auth/providers` and remain disabled when unconfigured.
ProviderSignIn names each unavailable provider, distinguishes loading and network
errors from missing configuration, and offers a refresh action after configuration
changes. A disabled GitHub button cannot be fixed by styling or zoom.
RecoveryPanel uses `/api/auth/mail`; mail is not wired by main.ts. These Sprint 3
capabilities are not claimed as live integrations.

The normal monolith now mounts password authentication with DATABASE_URL. See
[API](../../../../../docs/identity/API.md) and
[local setup](../../../../../docs/identity/LOCAL_AUTH.md). Database-backed runs
reject stub credentials. Repository verify lints/typechecks the web page;
browser acceptance must additionally exercise the real server and cookie flow.
