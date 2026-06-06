# Spike directory

Research scripts for Cursor Userdata launcher assumptions and archived SQLite
account-switch experiments.

## Active launcher validation

`userdata-launcher-verify.mjs` checks runtime assumptions for the product launcher.
See `LAUNCHER-FINDINGS.md` for the latest macOS results.

```bash
npm run research:userdata-launcher -- all
npm run research:userdata-launcher -- cleanup
```

Commands:

- `all` — run every check; may open brief test Cursor windows
- `cli` — bundled CLI discovery and supported flags
- `extensions` — compare `--list-extensions` for default vs custom userdata
- `launch` — launch a custom userdata window and verify isolation
- `reuse-window` — test `--reuse-window` with isolated temp userdatas only
- `detect` — verify `globalStorageUri` path derivation
- `cleanup` — quit test Cursor instances and remove temp dirs

The verifier never runs `--reuse-window` against the default Cursor userdata.

## Archived SQLite account-switch spike

`auth-slice.mjs` tested whether Cursor's active subscription could be changed by
mutating `state.vscdb`, cookies, and related persisted state. The result was
useful, but the approach is rejected for the product.

Do **not** use the SQLite spike as a recovery path, product option, or
implementation template.

The product direction is now:

```text
open Cursor with a selected --user-data-dir
```

Each named Cursor Userdata has its own isolated Cursor data root and is signed in
through Cursor normally once. The extension/launcher should orchestrate launching
Cursor with the right userdata root. It should not edit Cursor auth databases.

### What the SQLite spike proved

- `cursorAuth/*` rows are not enough for a working account switch.
- Cursor persists non-auth identity context such as `applicationUser` and Statsig
  state outside the auth slice.
- A full Cursor process restart is required; `Developer: Reload Window` is not a
  sufficient boundary.
- Full DB/session mutation can work in a controlled test, but it is too broad and
  risky for the product.
- Existing chat editors can point at account-specific composer data and become
  stuck on `Loading Chat` when state is mixed.

These findings support the `--user-data-dir` architecture: account identity
belongs to the whole Cursor userdata root.

### Running the archived SQLite spike

Prefer not to run these commands during product development. They remain only for
historical reproduction and should be treated as unsafe research tooling.

```bash
npm run research:sqlite-spike -- diagnose
npm run research:sqlite-spike -- list
```

Commands that save, switch, refresh, or repair accounts mutate or depend on local
Cursor auth/session state and are outside the product path.
