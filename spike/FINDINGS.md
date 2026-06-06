# Spike findings (2026-06-06)

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

`npm run spike -- diagnose` now reports this mismatch without printing raw tokens:

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
npm run spike -- save personal --force --full-db
npm run spike -- save work --force --full-db
npm run spike -- switch personal --offline --full-db
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
npm run spike -- login-link work
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
npm run spike -- login-link work --open-browser
```

On macOS this opens Google Chrome with a label-specific profile under
`~/.cursor-subscription-quick-switcher/browser-profiles/<label>` and first-run
suppression flags (`--no-first-run`, `--no-default-browser-check`,
`--disable-search-engine-choice-screen`). This keeps browser sessions isolated by
Saved Account without forcing a fresh Chrome setup each time.

## Validated result: offline full-DB switch works

The abandoned marketplace VSIX swaps the whole `state.vscdb`, root `Cookies`, root `Local Storage`, and root `Session Storage`, and requires a **full quit** (not reload).

The spike's full-DB/session path was validated on 2026-06-06:

- `npm run spike -- login-link personal --open-browser` captured and validated a Personal token (`shouldLogout=false`).
- `npm run spike -- login-link work --open-browser` captured and validated a Work token (`shouldLogout=false`).
- `npm run spike -- switch personal --offline --full-db`, then reopen Cursor:
  - `disk email: ale.burato@icloud.com`
  - `disk plan: pro`
  - `app membership: pro`
  - `identity match: yes`
  - Cursor chat worked.
- `npm run spike -- switch work --offline --full-db`, then reopen Cursor:
  - `disk email: alessandro.burato@imagicle.com`
  - `disk plan: enterprise`
  - `app teamIds: [23576005]`
  - `statsig team: 23576005`
  - `identity match: yes`
  - Cursor chat worked after a short load.

**Checkpoint conclusion:** the minimum viable mechanism is not auth-slice hot-swap.
It is an offline full identity snapshot restore: full `state.vscdb*` plus root
`Cookies`, `Local Storage`, and `Session Storage`, with token repair via the
browser PKCE `loginDeepControl` flow and no Settings logout.

No `Partitions/*` expansion was needed for this checkpoint.
