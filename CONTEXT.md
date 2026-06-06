# Cursor Subscription Quick Switcher

A local VSIX extension that lets a developer hot-swap between two or more Cursor subscriptions in the same Cursor install, without browser re-login on each switch.

## Language

**Account**:
A Cursor subscription identity (email + OAuth tokens) that determines billing and team membership.
_Avoid_: Profile, session, user

**Saved Account**:
A locally stored snapshot of the `cursorAuth/*` keys extracted from Cursor's `state.vscdb`, registered under a human-chosen label (e.g. "Work", "Personal").
_Avoid_: Profile, preset

**Switch**:
Replace the live `cursorAuth/*` keys in `state.vscdb` with those from a Saved Account, then reload the window so Cursor picks up the new identity.
_Avoid_: Log in, sign in

**Auth slice**:
The subset of `state.vscdb` keys under the `cursorAuth/` prefix (`accessToken`, `refreshToken`, `cachedEmail`, etc.). Only this slice changes on Switch; settings, extensions, and chat history are shared.
_Avoid_: Full database, state backup

**Hot-swap**:
A Switch performed in-place within the current Cursor install (mechanism A). No `--user-data-dir`, no second Cursor instance.
_Avoid_: Instance, profile launch

**Register**:
Capture the live `cursorAuth/*` keys into a new Saved Account. Requires the target Account to already be signed in via Cursor's normal login flow.
_Avoid_: Add account, import, OAuth

**Apply**:
Write a Saved Account's auth slice into live `state.vscdb` and reload the window so Cursor recognizes the new Account.
_Avoid_: Activate, load

**Active Account**:
The Account whose auth slice is currently written in live `state.vscdb`, identified by `cursorAuth/cachedEmail`.
_Avoid_: Current user, logged-in user

**Account store**:
The `~/.cursor-account-switcher/` directory on the user's machine. Holds Saved Account JSON files under `accounts/` and pre-Switch auth-slice backups under `backups/`.
_Avoid_: Extension storage, globalStorage, keychain

**Refresh**:
A network call to `POST https://api2.cursor.sh/oauth/token` that exchanges a Saved Account's `refreshToken` for a new `accessToken`. Updates the Saved Account JSON on success.
_Avoid_: Re-login, re-auth, token sync

**Stale Saved Account**:
A Saved Account whose Refresh failed (`shouldLogout: true`, network error, or empty token). Cannot be Applied until the user Registers it again via normal Cursor login.
_Avoid_: Expired account, invalid account

**Refresh schedule**:
Background Refresh runs for all non-stale Saved Accounts on activation and daily thereafter (or when JWT `exp` is within 24h). On-switch Refresh runs as a safety net if the target was not refreshed within the last hour.
_Avoid_: Polling, cron, keepalive

**Live sync**:
When a Refresh succeeds for the Active Account, write the updated auth slice to both the Saved Account JSON and live `state.vscdb`.
_Avoid_: Push to Cursor, update session

**Reference extension**:
The published VSIX `AliAldahmani.cursor-account-switcher` (v0.1.1). Its GitHub repo is dead (404). Use only as a negative/contrast reference — not a design template.
_Avoid_: Marketplace extension, AliAldahmani fork
