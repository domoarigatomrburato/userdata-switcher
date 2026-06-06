# Cursor Userdata Launcher Self-Grill

This is a simulated `grill-with-docs` pass. The questions are the design
pressure points; the answers are the decisions to implement unless a later test
contradicts them.

## 1. What is the product, exactly?

**Question:** Are we building an account switcher, a Cursor profile manager, or a
launcher?

**Answer:** A launcher. The product opens Cursor with a selected Cursor
Userdata. It does not switch Cursor subscription accounts in place and does not
use Cursor's built-in Profile feature.

## 2. What is the canonical noun?

**Question:** Should the UI say Profile, Account, User, Identity, or Userdata?

**Answer:** Use `Cursor Userdata` in documentation and `Userdata` in compact UI.
`Profile` conflicts with Cursor's built-in profiles. `Account` conflicts with
Cursor Settings and the sidebar Accounts menu.

## 3. What is the default launch?

**Question:** Is a normal no-flag Cursor launch part of the model?

**Answer:** Yes. It is the `Default Userdata`, represented as `kind: "default"`.
It displays as `<label> (default)`, for example `Work (default)`. The registry
does not store an absolute path for it; the path is resolved at runtime.

## 4. Where do managed userdatas live?

**Question:** Should custom userdatas store absolute paths?

**Answer:** No. Automatically created Managed Userdata lives under the
platform-specific Userdata Store Root, and registry entries store relative paths.
This keeps the registry portable across macOS, Linux, and Windows installs.

## 5. Can arbitrary external data dirs be adopted?

**Question:** If Cursor is already running with some custom `--user-data-dir`
outside our Store Root, should we let the user adopt it?

**Answer:** Not in the MVP. It would require storing an absolute
platform-dependent path. The extension may show it as `Unmanaged`, but adoption
is allowed only for the Default Userdata or a userdata already under the
Userdata Store Root.

## 6. Where does the registry live?

**Question:** Can we use extension `globalState` or `globalStorageUri`?

**Answer:** No. Those are per Cursor Userdata, which would fragment the registry.
The registry lives under the Userdata Store Root, outside all Cursor Userdata
roots.

## 7. What should the registry look like?

**Question:** What is the minimum durable schema?

**Answer:**

```json
{
  "version": 1,
  "userdatas": [
    {
      "id": "default",
      "kind": "default",
      "label": "Work"
    },
    {
      "id": "personal",
      "kind": "managed",
      "label": "Personal",
      "relativeDataDir": "userdata/personal/data"
    }
  ]
}
```

Labels are mutable. IDs and relative data dirs are stable.

## 8. How do we detect the Current Userdata?

**Question:** Should detection inspect Cursor account UI, tokens, or SQLite?

**Answer:** No. Detection is local filesystem/runtime matching:

- Compute the Default Userdata path for the platform.
- Compute each Managed Userdata path from the Store Root and registry.
- Compare `context.globalStorageUri.fsPath` with each expected userdata root.
- Also write/read a lightweight marker under the extension's global storage for
  managed launches to reduce ambiguity.

No auth state is read.

## 9. Where must the extension run?

**Question:** Can the extension run in a remote/workspace extension host?

**Answer:** No. It must be a UI extension (`extensionKind: ["ui"]`) because it
launches local Cursor and resolves local app-data paths.

## 10. How are extensions shared?

**Question:** Should each Userdata get its own extensions directory?

**Answer:** No. The intended product behavior is that Managed Userdata roots
keep access to the normal Cursor extensions directory. This keeps the switcher
extension and the user's other extensions available in new Userdata roots
without duplicate installs.

Local macOS Cursor validation showed that omitting `--extensions-dir` while
passing a custom `--user-data-dir` still used the shared `~/.cursor/extensions`
directory. Treat that as an empirical Cursor finding, not a generic VS Code
guarantee. Validate Linux and Windows before shipping; if needed, resolve and
pass an explicit shared Cursor extensions directory at launch time.

## 11. How does launch work?

**Question:** What should happen when the user opens another Userdata?

**Answer:** `Open With Userdata` must launch Cursor with the selected userdata
root and the current workspace when known. That launch correctness is the hard
requirement.

Prefer Cursor's bundled CLI discovered from the running Cursor installation.
Fallback to a `cursor` executable on `PATH`. The user should not have to install
shell integration manually for the happy path.

For a Managed Userdata:

```text
cursor --user-data-dir <managed-data-dir> <workspace?>
```

For Default Userdata, omit `--user-data-dir`.

`--reuse-window` is optional. macOS validation on 2026-06-06 showed it can reuse
an existing window within the same userdata, but duplicate windows are acceptable
for MVP. Never call `--reuse-window` without `--user-data-dir` from the switcher.

No runtime heartbeat is required for MVP. See `spike/LAUNCHER-FINDINGS.md`.

## 12. Should switching close the current window?

**Question:** Should `Open With Userdata` close the current window automatically?

**Answer:** No. The MVP launches the target Userdata and leaves the source
window open. It does not auto-close the source window.
Automatic close can come later behind an explicit setting after launch behavior
is validated.

## 13. What workspace gets opened?

**Question:** What should happen for folders, `.code-workspace` files, and
untitled multi-root workspaces?

**Answer:** Single folder: pass the folder path. Saved workspace file: pass the
workspace file. Untitled multi-root workspace: do not guess; launch the selected
Userdata without a workspace or ask the user to save the workspace first.

## 14. Does first-run sign-in need special handling?

**Question:** Should we automate Cursor login for a new Userdata?

**Answer:** No. The first time a Managed Userdata opens, Cursor's normal sign-in
flow appears. The product should not generate login links, store tokens, or touch
auth state.

## 15. Where does the switcher live in Cursor?

**Question:** Should the switcher be in the Activity Bar, sidebar Accounts menu,
Command Palette, status bar, or a custom panel?

**Answer:** MVP lives in the status bar and Command Palette.

- Status bar item: `Userdata: Work (default)` or `Userdata: Personal`.
- The status bar item always describes the Current Userdata for that specific
  window, not the last selected target and not a global default.
- Clicking the status bar item opens the `Open With Userdata` Quick Pick:
  - the Current Userdata is always shown first, marked current, and disabled
  - other Managed Userdata entries are selectable
  - the final item is `Create New Userdata...`
- Command Palette exposes the same actions:
  - `Cursor Userdata: Open With Userdata`
  - `Cursor Userdata: Create Userdata`
  - `Cursor Userdata: Rename Current Userdata`
  - `Cursor Userdata: Show Current Userdata`

Do not add an Activity Bar/sidebar view in the MVP. The switcher is a small
environment indicator plus launcher, not a persistent navigation surface. Do not
try to integrate with Cursor's sidebar Accounts menu; that menu belongs to the
VS Code Authentication API.

## 16. What is the first implementation slice?

**Answer:**

1. Scaffold the extension as a UI extension.
2. Implement Store Root resolution.
3. Implement registry read/write with the schema above.
4. Add status bar display for Current Userdata.
5. Auto-seed the Default Userdata entry when the registry is missing it.
6. Add `Rename Current Userdata`.
7. Add `Create Userdata`.
8. Add `Open With Userdata` launch via bundled CLI discovery.
9. Optionally append `--reuse-window` as a duplicate-avoidance optimization.
10. Validate on macOS with `npm run research:userdata-launcher -- all`, then
    Linux/Windows path and launch behavior.
