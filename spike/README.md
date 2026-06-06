# Cursor account switch spike

Validates whether swapping `cursorAuth/*` keys in `state.vscdb`, or a broader full-DB session bundle, is enough to change the active Cursor subscription.

## Validated checkpoint

On 2026-06-06, the working path was validated for both accounts:

- `personal` restored as `ale.burato@icloud.com`, plan `pro`, `identity match: yes`; Cursor chat worked.
- `work` restored as `alessandro.burato@imagicle.com`, plan `enterprise`, team `23576005`, `identity match: yes`; Cursor chat worked after a short load.

The viable switch mechanism is:

1. Keep a Saved Account with full `state.vscdb*` plus root browser session bundle.
2. Refresh or repair saved tokens with `login-link`, not Cursor Settings logout.
3. Fully quit Cursor.
4. Restore the full Saved Account snapshot with `switch <label> --offline --full-db`.
5. Reopen Cursor.

Auth-slice-only switching is retained only as a negative test.

## Prerequisites

- Node.js 22+ (uses built-in `node:sqlite`)
- Cursor signed in to your **first** account

## Manual test procedure

### 1. Snapshot account A (e.g. Personal)

While signed in as Personal:

```bash
npm run spike -- status
npm run spike -- save personal
npm run spike -- save personal --force --full-db
```

### 2. Snapshot account B (e.g. Work)

During the first capture, sign in as Work normally and save the full DB:

```bash
npm run spike -- status
npm run spike -- save work
npm run spike -- save work --force --full-db
```

After both accounts have full-DB snapshots, avoid Cursor Settings logout during token
refresh tests. Settings logout revokes the saved refresh token server-side. Instead,
generate a Cursor browser login URL from the spike and open it in a private/dedicated
browser session:

```bash
npm run spike -- login-link work --open-browser
```

The command keeps the PKCE verifier locally, polls Cursor auth, validates the new
refresh token, and updates the saved `work` snapshot in place.

`--open-browser` opens Chrome with a label-specific profile under
`~/.cursor-subscription-quick-switcher/browser-profiles/<label>` and first-run
suppression flags. That avoids the annoying fresh-profile prompts for Google sign-in,
default browser, and search engine selection during repeated tests. If Chrome is not
available, the command falls back to the default browser.

### 3. Switch without browser login

**Quit Cursor first** (`Cmd+Q`), then:

```bash
npm run spike -- switch personal --offline
```

Reopen Cursor and check **Cursor Settings → Account**.

If Settings changes but AI requests fail with `Authentication error`, retry the broader VSIX-equivalent path:

```bash
npm run spike -- switch personal --offline --full-db
```

Optional: retry with Cursor running is intentionally not supported by `switch`; Cursor keeps auth and identity context in memory and may overwrite disk state on quit/reload.

### 4. Record the result

| Outcome | Meaning |
|--------|---------|
| Email/plan changed and AI works after reopen | Full switch path works — proceed with extension design |
| Email/plan changed but AI fails | `cursorAuth/*` is not enough; run `diagnose` and test `--full-db` |
| Unchanged after reopen | Revisit spec (full DB, partitions, wider user-data bundle) |
| Broken / signed out | Spike failed — document and adjust approach |

### Known spike bug (fixed)

Early versions used `db.transaction()`, which `node:sqlite` does not support — `switch` backed up but **never wrote**. The script now uses `BEGIN IMMEDIATE` / `COMMIT` and verifies the email on disk after write.

Switch back when done:

```bash
npm run spike -- switch work --offline --full-db
# reopen Cursor
```

## Commands

```bash
npm run spike -- status
npm run spike -- list
npm run spike -- save <label> [--force]
npm run spike -- show <label>
npm run spike -- refresh <label>
npm run spike -- login-link <label> [--open-browser]
npm run spike -- switch <label> --offline
npm run spike -- switch <label> --offline --full-db
npm run spike -- diagnose
```

Snapshots live in `~/.cursor-subscription-quick-switcher/accounts/`. Pre-switch backups go to `backups/`.
