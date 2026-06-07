# MVP Contract

This document records the intended MVP behavior for Userdata Switcher. ADR 0001
owns the architectural decision; this file owns product behavior and acceptance
shape.

## Scope

The MVP is a small launcher surface:

- status bar item showing the Current Userdata for that exact window
- Quick Pick Userdata Menu opened from the status bar item
- creation of new Managed Userdata roots
- rename for the Current Userdata label
- launch of known Userdata roots with the current workspace when known

The MVP does not manage editor Profiles, integrate with sidebar sign-in menus,
or close source windows automatically.

## Startup

On activation, the extension resolves the Default Userdata for the current
Supported Host and ensures the host registry has a `kind: "default"` entry. If
no label has been chosen, it displays as `Default (default)`.

The user can rename the Default Userdata, for example to `Work`, without
changing its id, data directory, or launch behavior.

## Current Userdata

Current Userdata is per window. The status bar describes the userdata backing
the window that renders it. It never describes the last selected target or a
global default.

Status bar text:

- known default: `Work (default)` or `Default (default)`
- known managed userdata: `Personal`
- unknown external userdata: `Unmanaged`

The tooltip may include the current Editor Host name and resolved kind.

## Menu

Clicking the status bar opens a Quick Pick:

1. The title shows `Current: <label>`.
2. Items list other known Userdata entries only.
3. An `Actions` separator labels the action section.
4. When Current Userdata is known, a `$(edit) Rename Current Userdata...`
   action appears above `$(add) Create New Userdata...`.
5. When Current Userdata is unknown, only `$(add) Create New Userdata...`
   appears.

The current userdata is not a selectable item. Action CTAs are identified by
structured action data, not by matching their label text.

If there are no other userdatas yet, the menu still opens and shows the rename
and create CTAs when Current Userdata is known.

## Create And Rename

Create flow:

1. Prompt for a Userdata Label.
2. Derive a stable id.
3. Create a Managed Userdata directory under the Userdata Store Root.
4. Persist the registry entry.
5. Launch the current Supported Host with the new userdata and current workspace
   when possible.

Rename changes only the label. It does not affect ids, relative data
directories, or launch behavior.

## Launching

Managed Userdata launch:

```text
<host-cli> --user-data-dir <managed-data-dir> --extensions-dir <shared-extensions-dir> <workspace?>
```

The launcher adds `--extensions-dir` only when the Supported Host adapter
resolves a Shared Extensions Directory for managed launches.

Default Userdata launch omits `--user-data-dir`.

The launcher must not force `--reuse-window`. VS Code treats reuse as "the last
active window", which can belong to a different userdata root and prevent the
selected userdata instance from opening. Duplicate-window handling is outside
the MVP until it can be implemented per userdata instance.

If the launcher cannot find or spawn a usable host CLI, it reports the error and
stops.

## Workspace Argument

The launcher passes:

- single-folder workspace: the folder path
- saved workspace file: the `.code-workspace` file
- empty or untitled multi-root workspace: no workspace argument

The MVP does not guess untitled multi-root workspace state.

## Unmanaged Userdata

An external `--user-data-dir` not known to the registry displays as
`Userdata: Unmanaged`. The MVP does not adopt arbitrary external paths because
that would require storing absolute platform-dependent paths.

## Extensions

Managed Userdata roots should keep access to the normal extension directory for
the current Supported Host. If a supported host does not share extensions by
default, the launcher should pass an explicit runtime-resolved shared
extensions directory for managed launches.

## Commands

The MVP contributes:

- `Userdata Switcher: Open With Userdata`
- `Userdata Switcher: Create Userdata`
- `Userdata Switcher: Rename Current Userdata`
- `Userdata Switcher: Show Current Userdata`
