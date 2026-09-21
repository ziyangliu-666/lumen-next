# Sign-in, sign-up and account panels

Owner: LU YI. `#/signin` uses shared shell/UI controls and theme classes.
`authClient.ts` calls same-origin JSON endpoints without storing session tokens.
Pending requests disable controls, duplicate submits are guarded, and passwords
are cleared after attempts. Signup requires 8 Unicode code points. Users go to
`#/home`; staff go to `#/admin`, protected by shell StaffGuard.

AccountPanel is reachable through Manage signed-in account. It supports profile
and password changes and signout-one/all. A password change revokes other
sessions. Deletion is deliberately absent. Canonical Settings composition still
requires shell review; no cross-page imports were added.

OAuth buttons use `/api/auth/providers` and remain disabled when unconfigured.
RecoveryPanel uses `/api/auth/mail`; mail is not wired by main.ts. These Sprint 3
capabilities are not claimed as live integrations.

The normal monolith now mounts password authentication with DATABASE_URL. See
[API](../../../../../docs/identity/API.md) and
[local setup](../../../../../docs/identity/LOCAL_AUTH.md). Database-backed runs
reject stub credentials. Repository verify lints/typechecks the web page;
browser acceptance must additionally exercise the real server and cookie flow.
