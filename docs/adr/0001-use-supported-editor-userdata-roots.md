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
- Antigravity IDE

Unsupported hosts are not guessed. The extension reports a clear unsupported
host error instead of falling back to best-effort behavior.

Supported-host behavior lives behind one adapter boundary in `src/host.ts`:

- host display name
- host storage namespace
- Userdata Store Root resolution per platform
- Default Userdata root resolution per platform
- Shared Extensions Directory resolution per platform
- CLI executable names
- bundled CLI discovery inputs

The generic implementation owns:

- registry persistence
- Current Userdata detection from extension storage paths
- status bar and Quick Pick behavior
- Managed Userdata creation and rename
- launch command construction with `--user-data-dir` and optional
  `--extensions-dir` when the adapter supplies a Shared Extensions Directory
- process spawning and startup error handling

The Userdata Store Root is host-namespaced under a short generic product
directory:

- macOS: `~/Library/Application Support/udsw/<host>`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/udsw/<host>`
- Windows: `%LOCALAPPDATA%\udsw\<host>`

Each supported host gets its own registry. Userdatas for different hosts must
not share one registry.

Managed Userdata roots use the short relative layout `u/<id>`. The short names
are intentional because VS Code creates Unix socket files under
`--user-data-dir` on macOS, and long socket paths fail before the managed window
starts.

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
<host-cli> --user-data-dir <managed-userdata-dir> --extensions-dir <shared-extensions-dir> <workspace?>
```

The launcher adds `--extensions-dir` only when the Supported Host adapter
resolves a Shared Extensions Directory for managed launches.

For Default Userdata, omit `--user-data-dir`.

The launcher must not force `--reuse-window`. VS Code treats reuse as "the last
active window", which can belong to a different userdata root and prevent the
selected userdata instance from opening. Duplicate-window handling is not an MVP
guarantee until it can be implemented per userdata instance.

The status bar must describe the Current Userdata for the specific window that
is rendering it. It must not describe the last selected target or a global
default.

Clicking the status bar opens the Userdata Menu. The menu title shows the
Current Userdata for context, then the menu lists other selectable known Userdata
entries, then an `Actions` section with actions such as
`$(add) Create New Userdata...`. If the current userdata is Unmanaged, it is
still shown in the title, but arbitrary external userdata roots are not adopted
in the MVP.

Managed userdata deletion moves the managed directory to the system trash,
removes the registry entry, and refuses deletion when:

- the target is the current window's userdata,
- the target is the default userdata,
- or a Running Userdata Instance is detected for the target via the editor IPC
  socket under the userdata root on macOS/Linux, or via matching editor
  processes for the target `--user-data-dir` on Windows.

When a running instance is detected, the confirmation dialog
offers **Quit and delete**, which quits that instance before trashing files.
Success is reported only after quit and folder removal are verified.

On Windows, open-file locking during trash remains a secondary guard when
process detection cannot enumerate command lines.

## Consequences

Adding another editor host is a validation task: add an adapter entry only after
confirming its default userdata path, CLI name, bundled CLI layout, and Shared
Extensions Directory behavior.

The registry format remains host-neutral. The storage location provides host
separation, so no compatibility layer is required between supported hosts.
