# ADR 0001: Use isolated Cursor Userdata roots

## Status

Accepted.

## Context

The project started by testing whether Cursor subscription identity could be
switched by modifying persisted auth/session state inside Cursor's default data
directory.

The spike proved that:

- `cursorAuth/*` is not enough for working Cursor AI requests.
- Cursor identity includes broader persisted state such as `applicationUser`,
  Statsig bootstrap data, browser session state, and account-specific
  chat/composer data.
- Window reload is not a reliable boundary; Cursor needs a process restart for
  identity changes to take effect cleanly.
- Full DB/session mutation can work in a controlled test, but it touches broad,
  sensitive, version-dependent Cursor internals.

Cursor's built-in `Profile` feature does not solve this because it manages
settings/keybindings/snippets/extensions, not Cursor subscription identity.

The sidebar `Accounts` menu is also not this product's domain. It is backed by
VS Code's Authentication API for extension auth providers and does not represent
Cursor subscription identity.

## Decision

The product will manage named Cursor Userdata roots and launch Cursor with the
selected root:

```text
cursor --user-data-dir <managed-userdata-dir> <workspace>
```

This is the only supported switching mechanism.

The extension and launcher must not:

- write Cursor OAuth tokens or refresh tokens
- write `cursorAuth/*`
- edit `state.vscdb`
- copy/restore full Cursor DB snapshots
- copy/restore cookies or Chromium session storage
- clean workspace composer state as part of switching

Each new Cursor Userdata is authenticated through Cursor's normal sign-in flow
once. After that, opening with that userdata root restores the intended Cursor
identity naturally.

Automatically created Cursor Userdata roots live under this tool's
platform-specific app data directory:

- macOS: `~/Library/Application Support/Cursor Userdata Switcher`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/cursor-userdata-switcher`
- Windows: `%LOCALAPPDATA%\Cursor Userdata Switcher`

Managed Userdata entries must store stable ids and relative paths under that
root. They must not store absolute platform-specific paths unless a future
explicit custom-location feature is added.

The vanilla no-flag Cursor launch is the Default Userdata. It is represented as
`kind: "default"` and displayed as `<label> (default)`, for example
`Work (default)`. A new installation must auto-seed this registry entry if it is
missing, using a generic label such as `Default`. The user may rename that label,
but adopting the Default Userdata is not a required setup step.

Arbitrary external `--user-data-dir` locations are not Managed Userdata in the
MVP because registering them would require storing absolute platform-dependent
paths. They should be shown as unmanaged unless they are the Default Userdata or
already live under the Userdata Store Root.

The extension must run in the local UI extension host (`extensionKind: ["ui"]`).
It launches local Cursor processes and resolves local app-data paths, so running
as a remote/workspace extension would put the launcher on the wrong machine.

`Open With Userdata` must launch Cursor with the selected userdata root and the
current workspace when known. That launch correctness is the MVP requirement.

`--reuse-window` is an optional optimization to avoid duplicate windows within
the same userdata. It is not an MVP guarantee. The launcher must always pass
`--user-data-dir` for Managed Userdata and must never call `--reuse-window`
without `--user-data-dir`, because on default userdata it can hijack the active
window.

The status bar must describe the Current Userdata for the specific window that
is rendering it. It must not describe the last selected target, a global default,
or the Cursor account shown in settings.

Clicking the status bar opens the Userdata Menu. The menu shows the Current
Userdata first as a non-actionable item, then selectable known Cursor Userdata
entries, then a `Create New Userdata...` action. If the current userdata is
Unmanaged, it is still shown first, but arbitrary external userdata roots are not
adopted in the MVP.

## Consequences

The implementation becomes a cross-platform launcher/orchestrator instead of an
auth-state mutator.

The extension must be able to:

- store a registry outside any Cursor userdata root
- resolve the Userdata Store Root per platform
- auto-seed the Default Userdata entry without requiring setup
- rename Userdata labels
- create named Managed Userdata entries
- detect the Current Userdata from runtime paths and registry markers
- launch Cursor with a selected `--user-data-dir`
- optionally open the current workspace in the selected userdata
- preserve access to installed extensions for managed userdatas

The archived SQLite spike remains useful only as historical evidence for this
decision.

Local macOS Cursor validation on 2026-06-06 showed that:

- `cursor --user-data-dir <tmp> --new-window <workspace>` boots an isolated
  userdata with its own `state.vscdb`
- omitting `--extensions-dir` while passing a custom `--user-data-dir` still uses
  the normal shared Cursor extensions directory (`~/.cursor/extensions`)
- user extensions activate in the new userdata window, not only in CLI list output
- same userdata + `--reuse-window` reuses the existing instance; different
  userdata + `--reuse-window` launches separately and does not affect default
  userdata

See `spike/LAUNCHER-FINDINGS.md` and `npm run research:userdata-launcher -- all`.

Linux and Windows still need the same checks. If a platform does not share
extensions by default, the launcher should resolve and pass an explicit shared
Cursor extensions directory rather than requiring users to reinstall the switcher
in every managed userdata.
