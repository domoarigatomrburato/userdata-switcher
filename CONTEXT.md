# Cursor Subscription Quick Switcher

A local VSIX extension that lets a developer hot-swap between two or more Cursor subscriptions in the same Cursor install, without browser re-login on each switch.

## Language

**Account**:
A Cursor subscription identity (email + OAuth tokens) that determines billing and team membership.
_Avoid_: Profile, session, user

**Saved Account**:
A locally stored full identity snapshot registered under a human-chosen label (e.g. "Work", "Personal"). The current validated snapshot includes `cursorAuth/*`, full `User/globalStorage/state.vscdb*`, root `Cookies`, root `Local Storage`, and root `Session Storage`.
_Avoid_: Profile, preset

**Switch**:
Restore a Saved Account into Cursor's live user data while Cursor is fully quit, then reopen Cursor so it starts with the restored identity.
_Avoid_: Log in, sign in

**Process boundary**:
The full Cursor process exit/restart required for a Switch to take effect. Spike result: `Developer: Reload Window` can leave an already-running process on the previous Account even when disk has been restored to the target Account.
_Avoid_: Window reload, renderer reload

**Auth slice**:
The subset of `state.vscdb` keys under the `cursorAuth/` prefix (`accessToken`, `refreshToken`, `cachedEmail`, etc.). Spike result: this slice controls visible cached Account fields but is insufficient for working Cursor AI requests on its own.
_Avoid_: Full identity, complete session

**Full identity snapshot**:
The persisted Cursor identity context needed for a working Switch: full `state.vscdb*` plus root Chromium session files/directories. Carries non-auth user/team state such as `applicationUser` and Statsig bootstrap alongside tokens.
_Avoid_: Auth slice, profile

**Hot-swap**:
A Switch performed within the current Cursor install by replacing local persisted state, not by launching a second Cursor instance with a different `--user-data-dir`. Current spike requires Cursor to be fully quit before the write.
_Avoid_: Instance, profile launch

**Register**:
Capture the live Cursor identity state into a new Saved Account. Requires the target Account to already be signed in via Cursor's normal login flow, or repaired through Browser login link.
_Avoid_: Add account, import, OAuth

**Apply**:
Write a Saved Account's full identity snapshot into Cursor's live user data while Cursor is quit.
_Avoid_: Activate, load

**Active Account**:
The Account whose identity snapshot is currently restored in Cursor's live user data, usually identified by `cursorAuth/cachedEmail`.
_Avoid_: Current user, logged-in user

**Account store**:
The `~/.cursor-subscription-quick-switcher/` directory on the user's machine. Holds Saved Account JSON files and full snapshots under `accounts/`, pre-Switch backups under `backups/`, and label-specific browser profiles under `browser-profiles/`.
_Avoid_: Extension storage, globalStorage, keychain

**Refresh**:
A network call to `POST https://api2.cursor.sh/oauth/token` that exchanges a Saved Account's `refreshToken` for a new `accessToken`. Updates the Saved Account JSON on success.
_Avoid_: Re-login, re-auth, token sync

**Browser login link**:
A generated Cursor `loginDeepControl` PKCE URL plus in-process verifier/polling state. Used to repair or refresh a Saved Account without using Cursor Settings logout. The spike can open this in a label-specific Chrome profile with `--open-browser`.
_Avoid_: Settings login, pasted login URL

**Settings logout**:
The logout action in Cursor Settings. Spike result: it revokes the active refresh token server-side and can make previously saved snapshots return `shouldLogout: true`; do not use it as a switching mechanism.
_Avoid_: Switch, refresh

**Stale Saved Account**:
A Saved Account whose Refresh failed (`shouldLogout: true`, network error, or empty token). Cannot be Applied until repaired with Browser login link or re-registered from a normal Cursor login.
_Avoid_: Expired account, invalid account

**Refresh schedule**:
Background Refresh runs for all non-stale Saved Accounts on activation and daily thereafter (or when JWT `exp` is within 24h). On-switch Refresh runs as a safety net if the target was not refreshed within the last hour.
_Avoid_: Polling, cron, keepalive

**Live sync**:
When a Refresh succeeds for the Active Account, write the updated tokens to both the Saved Account JSON and the saved/live `state.vscdb` as appropriate.
_Avoid_: Push to Cursor, update session

**Orphaned composer pointer**:
Workspace UI state that references a chat/composer id not present in the active Account's global composer store. It can reopen as an infinite `Loading Chat` tab after a Switch. The switcher should preserve chats by saving the current Account before switching away, then remove only orphaned workspace pointers after restoring the target Account.
_Avoid_: Chat deletion, composer cleanup

**Reference extension**:
The abandoned VSIX `AliAldahmani.cursor-account-switcher` (v0.1.1). Its GitHub repo is dead (404). Use only as a negative/contrast reference — not a design template.
_Avoid_: Cursor Account Switcher, AliAldahmani fork
