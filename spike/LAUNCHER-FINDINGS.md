# Launcher runtime findings (2026-06-06)

Validated on macOS with Cursor stable `3.7.12` (`arm64`).

Repeat the checks with:

```bash
npm run research:userdata-launcher -- all
npm run research:userdata-launcher -- cleanup
```

The verifier uses temp userdata dirs only. It never runs `--reuse-window`
against the default Cursor userdata.

## Product priority

The required launcher behavior is:

```text
Open Cursor with the selected --user-data-dir (and workspace when known).
```

`--reuse-window` is a nice-to-have optimization to avoid duplicate windows
within the same userdata. It is not an MVP guarantee.

## Verified on macOS

| Claim | Result |
|-------|--------|
| Bundled CLI exists and supports `--user-data-dir`, `--new-window`, `--reuse-window`, `--extensions-dir` | Pass |
| `cursor --user-data-dir <tmp> --new-window <workspace>` boots a real window | Pass |
| Custom userdata gets its own `User/globalStorage/state.vscdb` | Pass |
| `--list-extensions` is identical for default vs custom userdata | Pass (`5` extensions) |
| User extensions activate in a new custom userdata window | Pass (`mhutchie.git-graph` in `exthost.log`) |
| Shared extensions directory is `~/.cursor/extensions` | Pass |
| Default userdata path is `~/Library/Application Support/Cursor` | Pass on stable install |
| `globalStorageUri` path strips back to userdata root | Pass (logic check) |
| Same userdata + `--reuse-window` does not create a duplicate main process | Pass |
| Same userdata + different folder + `--reuse-window` reuses the window | Pass |
| Different userdata + `--reuse-window` launches a separate instance | Pass |
| Different userdata + `--reuse-window` does not change default userdata process count | Pass |
| Second `--new-window` for same userdata creates another window log | Pass |

## Launcher contract

Managed userdata launch:

```text
cursor --user-data-dir <managed-userdata-dir> [--reuse-window] <workspace?>
```

Default userdata launch:

```text
cursor [--reuse-window] <workspace?>
```

Rules:

- Always pass `--user-data-dir` for managed userdata.
- Never call `--reuse-window` without `--user-data-dir` from the switcher. On
  default userdata it can hijack the active window.
- Prefer `--new-window` when the product explicitly wants another window.
- Prefer `--reuse-window` only as an optional duplicate-avoidance optimization
  within the target userdata.

## Deferred or still open

| Claim | Status |
|-------|--------|
| Switcher extension activates in a new managed userdata | Not tested yet; needs a built extension |
| `context.globalStorageUri` inside a real extension host | Logic verified; one extension smoke test remains |
| Linux / Windows default userdata paths | Not tested here |
| Linux / Windows extension sharing without `--extensions-dir` | Not tested here |
| Nightly / Lab default userdata paths | Not installed on validation machine |
| Cross-userdata focus semantics beyond process/window counts | Not required for MVP |

## Implementation notes

- Happy-path CLI discovery: `appRoot/bin/cursor`, with `app/out/cli.js` as a
  lower-level fallback.
- A `cursor` executable on `PATH` is optional fallback only.
- Runtime heartbeat and running-instance tracking are not required for MVP.
- If Linux or Windows do not share extensions by default, pass an explicit
  `--extensions-dir` resolved to the normal Cursor extensions directory.
