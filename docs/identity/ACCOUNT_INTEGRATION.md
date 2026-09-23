# Account navigation and Settings integration

Identity components are implemented and locally verified. The shared
composition is part of the identity pull request, under the shell and Settings
owners' review.

## Identity components

- AccountSettings guards AccountPanel with the shared current-account hook.
  Loading, lookup errors, signed-out users and development stubs are distinct.
  Users and staff manage only their own account.
- AccountActions supplies Account and Sign out for real sessions, Sign in for
  visitors, and retry after lookup errors. The header does not expose email
  addresses or call real-session signout for a development stub.
- Successful signup, password login and account mutations announce the existing
  lumen:auth-changed event. The event carries no credentials or account data.
- Signout disables its button and uses a synchronous busy guard. Failure leaves
  the account visible with retry feedback; success navigates to signin.
- Account revalidation retains a disabled editor so feedback is not discarded.
  A changed account ID remounts the editor and discards the previous form state.

## Shared composition

The composition changes three shared files:

1. Settings.tsx accepts accountContent, tab and onTabChange. The Account
   placeholder becomes a content slot; Wallet and Keys content is unchanged.
2. core/shell.tsx accepts optional accountActions, wraps navigation on narrow
   highlights nested Settings routes and labels the main navigation. Header
   and page spacing are unchanged.
3. main.tsx composes the identity components and Settings routes.

Routes: #/settings retains Wallet as the default, #/settings/account opens Account,
and #/settings/keys opens Keys. Tab selection updates the route. Reloading a deep
link or using the Account shortcut after visiting Wallet selects the correct tab.
Only the composition root imports both pages; there is no page-to-page import.

These files require the relevant owners' review under CODEOWNERS.

## Layout and accessibility

The sign-in card places password fields beside provider choices on desktop and
stacks them on small screens. Account profile/current-password and new-password/
signout sections similarly reflow. Card spacing avoids duplicate padding from
the shared controls. Normal text and input sizes are retained; no CSS zoom,
transform scaling or fixed-height clipping is used.

ProviderSignIn distinguishes loading, lookup failures and unconfigured providers.
Unavailable choices are explained by name. Refresh availability rechecks server
configuration without presenting a network failure as a missing credential.

Settled signin/account forms were checked in a fresh normal-zoom browser context
at 960 x 540, 1366 x 768 and 390 x 844 without horizontal or additional vertical
document overflow. Signin also passed 1024 x 600. Long errors, signup and arbitrary
application content may scroll naturally. This is not a guarantee that every
screen or every data set fits one viewport.

## Acceptance evidence and scope

- SSR and transport tests cover account/header states, auth refresh notifications,
  provider explanations, pending actions and rejected requests.
- PostgreSQL-backed browser checks passed signup-to-header refresh, Account
  navigation, Settings tabs/deep-link reload, profile persistence, password change,
  password clearing, header signout, 401 after signout and password relogin.
- An intercepted signout failure retained account content. Two immediate signout
  clicks produced one request; removing interception allowed real signout.
- Provider lookup failure/retry and both enabled provider buttons were checked.
- Local real-provider outcomes are summarized in OAUTH_SETUP.md. No private
  screenshots, browser profiles, account identities, secrets or databases ship
  with this change.

Remaining work includes owner review, remote CI, staging,
GitHub logout/relogin, live negative/staff cases and merged delivery. See
[delivery status](DELIVERY.md).
