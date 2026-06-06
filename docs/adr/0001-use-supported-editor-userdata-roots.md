# ADR 0001: Use supported editor userdata roots

## Status

Accepted.

## Context

VS Code-family desktop editors can be launched with `--user-data-dir` to run
with an alternate userdata root. A userdata root is a process boundary: windows
started with one root use that root's persisted editor state until the process
exits.

The same extension can run inside multiple supported editor hosts, but each host
has different default userdata directories and CLI names. A host-neutral product
needs one generic launcher model with explicit host adapters, not a scattering
of host checks through the codebase.

## Decision

The product is **Userdata Switcher**, a host-neutral extension for explicitly
supported VS Code-family desktop editor hosts.

The initial supported hosts are:

- Cursor
- Visual Studio Code
- Visual Studio Code Insiders

Unsupported hosts are not guessed. The extension reports a clear unsupported
host error instead of falling back to best-effort behavior.

Supported-host behavior lives behind one adapter boundary:

- host display name
- host storage namespace
- default userdata directory name
- CLI executable names
- bundled CLI discovery inputs

The generic implementation owns:

- registry persistence
- Current Userdata detection from extension storage paths
- status bar and Quick Pick behavior
- Managed Userdata creation and rename
- launch command construction with `--user-data-dir`
- process spawning and startup error handling

The Userdata Store Root is host-namespaced under a generic product directory:

- macOS: `~/Library/Application Support/Userdata Switcher/<host>`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/userdata-switcher/<host>`
- Windows: `%LOCALAPPDATA%\Userdata Switcher\<host>`

Each supported host gets its own registry. Userdatas for different hosts must
not share one registry.

Command identifiers and command titles are generic: `userdataSwitcher.*` and
`Userdata Switcher: ...`. Host names may appear in prompts, errors, and
tooltips when they clarify which editor will be launched.

The extension must run in the local UI extension host (`extensionKind: ["ui"]`).
It launches local editor processes and resolves local app-data paths, so running
as a remote/workspace extension would put the launcher on the wrong machine.

`Open With Userdata` must launch the current supported host with the selected
userdata root and the current workspace when known. That launch correctness is
the MVP requirement.

For Managed Userdata:

```text
<host-cli> --user-data-dir <managed-userdata-dir> <workspace?>
```

For Default Userdata, omit `--user-data-dir`.

`--reuse-window` is an optional optimization to avoid duplicate windows within
the same userdata. It is not an MVP guarantee. The launcher must always pass
`--user-data-dir` for Managed Userdata and must never call `--reuse-window`
without `--user-data-dir`, because default-host reuse can hijack the active
window.

The status bar must describe the Current Userdata for the specific window that
is rendering it. It must not describe the last selected target or a global
default.

Clicking the status bar opens the Userdata Menu. The menu title shows the
Current Userdata for context, then the menu lists other selectable known Userdata
entries, then a `Create New Userdata...` action. If the current userdata is
Unmanaged, it is still shown in the title, but arbitrary external userdata roots
are not adopted in the MVP.

## Consequences

Adding another editor host is a validation task: add an adapter entry only after
confirming its default userdata path, CLI name, bundled CLI layout, and
extension-directory behavior.

The registry format remains host-neutral. The storage location provides host
separation, so no compatibility layer is required between supported hosts.
