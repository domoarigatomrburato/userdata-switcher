# Spike findings (2026-06-06)

## Superseded product decision

This spike is archived research. It must not be treated as a product option or
production implementation strategy.

The product direction is now a Cursor Userdata launcher:

```text
open Cursor with a selected --user-data-dir
```

The findings below explain why account identity should be isolated at the whole
userdata-root boundary. They do not justify mutating Cursor auth/session files in
the extension.

## Result: auth-slice only is **not sufficient**

| Layer | After `switch personal` | UI after reload |
|-------|-------------------------|-----------------|
| `state.vscdb` `cursorAuth/*` | Personal (verified) | Still Work |

**Conclusion:** While Cursor is running, the Account UI follows an **in-memory session**, not the auth keys on disk. `Developer: Reload Window` does not re-read `cursorAuth/*` from SQLite.

After a full quit/reopen, Settings can show the target Account, but AI/backend calls still fail:

| Layer | After offline auth-slice switch to Personal |
|-------|---------------------------------------------|
| `cursorAuth/*` | Personal |
| `src.vs.platform.reactivestorage...persistentStorage.applicationUser` | still carries Work `aiSettings.teamIds` |
| `workbench.experiments.statsigBootstrap.evaluated_keys` | still carries Work user/team identity |
| AI transport | `ERROR_NOT_LOGGED_IN` / `Authentication error` |

**Updated conclusion:** `cursorAuth/*` controls visible cached Account fields, but it is not the whole identity context. Cursor also persists user/team-derived state outside `cursorAuth/*`. Mixing a Personal token with Work team/user context produces backend authentication failures.

`npm run research:sqlite-spike -- diagnose` now reports this mismatch without printing raw tokens:

```text
identity match:  NO (non-auth state belongs to another account)
```

## Marketplace VSIX comparison

Downloaded `AliAldahmani.cursor-account-switcher` v0.1.1 from the Visual Studio Marketplace VSIX package.

The VSIX does **not** update individual SQLite keys. It saves/restores:

- Full `User/globalStorage/state.vscdb`
- Optional `User/globalStorage/state.vscdb.backup`
- Root `Cookies`, `Cookies-journal`
- Root `Local Storage/`
- Root `Session Storage/`

It does **not** save `Partitions/*`, `state.vscdb-wal`, or `state.vscdb-shm`.

The useful difference versus the current spike is therefore the full `state.vscdb` restore, not a special cookie mechanism. This would carry `applicationUser`, Statsig bootstrap, team IDs, and other non-auth identity context along with the token.

The spike now has a `--full-db` mode to test the VSIX-equivalent approach without installing the extension:

```bash
npm run research:sqlite-spike -- save personal --force --full-db
npm run research:sqlite-spike -- save work --force --full-db
npm run research:sqlite-spike -- switch personal --offline --full-db
```

Because the current saved accounts were captured before session/full-DB support, they show as `auth only, no full DB` and must be re-saved after a normal login for each Account.

## Secondary bug (fixed)

Early spike used `db.transaction()`, which `node:sqlite` lacks — `switch` created backups but never wrote. Fixed with `BEGIN IMMEDIATE` / `COMMIT` + post-write verification.

## Token revocation finding

Cursor Settings logout revokes the active refresh token server-side. A snapshot that
was valid immediately before Settings logout can start returning:

```text
shouldLogout: true
```

from `POST https://api2.cursor.sh/oauth/token` right after logout. That means a
Settings logout is not a safe way to move between accounts while preserving saved
snapshots.

The spike now has a browser-login command that mirrors Cursor's own
`loginDeepControl` PKCE flow without using Settings logout:

```bash
npm run research:sqlite-spike -- login-link work
```

It prints a one-time login URL, keeps the PKCE verifier in the running process,
polls `/auth/poll`, validates the returned refresh token, and updates the existing
saved account JSON plus saved full `state.vscdb` snapshot.

## Browser UX finding

Opening the generated login URL in a brand-new temporary Chrome profile is noisy on
macOS: Chrome can prompt for Google sign-in and search engine selection before the
Cursor login can proceed.

The spike now supports:

```bash
npm run research:sqlite-spike -- login-link work --open-browser
```

On macOS this opens Google Chrome with a label-specific profile under
`~/.cursor-subscription-quick-switcher/browser-profiles/<label>` and first-run
suppression flags (`--no-first-run`, `--no-default-browser-check`,
`--disable-search-engine-choice-screen`). This keeps browser sessions isolated by
Saved Account without forcing a fresh Chrome setup each time.

## Research result: offline full-DB mutation can work, but is rejected

The abandoned marketplace VSIX swaps the whole `state.vscdb`, root `Cookies`, root `Local Storage`, and root `Session Storage`, and requires a **full quit** (not reload).

The spike's full-DB/session path was validated on 2026-06-06:

- `npm run research:sqlite-spike -- login-link personal --open-browser` captured and validated a Personal token (`shouldLogout=false`).
- `npm run research:sqlite-spike -- login-link work --open-browser` captured and validated a Work token (`shouldLogout=false`).
- `npm run research:sqlite-spike -- switch personal --offline --full-db`, then reopen Cursor:
  - `disk email: ale.burato@icloud.com`
  - `disk plan: pro`
  - `app membership: pro`
  - `identity match: yes`
  - Cursor chat worked.
- `npm run research:sqlite-spike -- switch work --offline --full-db`, then reopen Cursor:
  - `disk email: alessandro.burato@imagicle.com`
  - `disk plan: enterprise`
  - `app teamIds: [23576005]`
  - `statsig team: 23576005`
  - `identity match: yes`
  - Cursor chat worked after a short load.

**Research conclusion:** the minimum state boundary for Cursor account identity is
broader than `cursorAuth/*`; it includes persisted global identity/session data
and account-specific chat/composer state.

**Product conclusion:** do not implement full identity snapshot restore. It is too
broad, sensitive, and Cursor-version-dependent. Use separate Cursor
`--user-data-dir` roots instead.

No `Partitions/*` expansion was needed for this checkpoint.

## Negative result: running process + Reload Window is insufficient

Tested `work -> personal` while Cursor was still running:

```bash
npm run research:sqlite-spike -- switch personal --unsafe-running --reload-window --full-db
```

Observed behavior:

- The CLI restored disk to Personal and verified `state.vscdb`.
- An already-running Cursor process with an open Work window kept using Work in UI
  and chat.
- Manual `Developer: Reload Window` still kept that window on Work.
- `npm run research:sqlite-spike -- diagnose` showed disk was Personal and internally coherent.
- Quitting Cursor did not revert disk back to Work.
- Reopening Cursor started on Personal and chat worked.

**Conclusion:** a full Cursor process restart is the validated identity boundary.
Window reload is not enough. A future extension should launch Cursor with the
selected `--user-data-dir`; it should not try to mutate identity state underneath
an already-running process.

## Chat editor restore finding

After switching from Work to Personal and reopening Cursor, an existing Work chat tab
could remain open and show `Loading Chat` forever. Closing that stale tab and opening
a new chat worked.

Root cause found with a marker chat named `CSSW_PERSONAL_MARKER_20260606`:

- Account-specific chat/composer records live in global `state.vscdb`, including:
  - `ItemTable` key `composer.composerHeaders`
  - `cursorDiskKV` keys like `composerData:<composerId>`,
    `bubbleId:<composerId>:<bubbleId>`, and `checkpointId:<composerId>:<checkpointId>`
- Workspace UI state can still point at the previous Account's composer id:
  - per-workspace `composer.composerData`
  - per-workspace `workbench.parts.embeddedAuxBarEditor.state`
  - editor id `workbench.editor.composer.input`

When the target Account's global composer store does not contain the composer id
referenced by workspace UI state, Cursor reopens a chat editor that cannot resolve
its backing composer data and sits at `Loading Chat`.

The spike experimented with handling this on full switch:

1. Before switching away, if the current disk Account matches a saved Account, save
   its full snapshot so newly created chats are preserved.
2. Restore the target Account full snapshot.
3. Scan workspace storage and remove only composer editor pointers whose composer id
   is absent from the target Account's global composer store.

Validated behavior:

- A Personal marker chat was preserved after switching back to Personal.
- Switching from Personal to Work then logged:

```text
Cleared orphaned chat editor state in 1 workspace(s) (1 composer id(s))
```

- After reopening Work, the Personal marker composer id was absent from live global
  and workspace state, Work identity was coherent, and chat worked.

This cleanup should not be part of the product path. Separate Cursor Userdata
roots avoid mixing account-specific composer state in the first place.
