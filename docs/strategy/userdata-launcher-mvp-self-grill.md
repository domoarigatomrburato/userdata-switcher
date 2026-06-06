# Cursor Userdata Switcher MVP Self-Grill

This is a second simulated `grill-with-docs` pass focused on the final MVP
shape. It records the decisions to implement unless a later validation test
contradicts them.

## 1. What must the MVP actually ship?

**Question:** Is the MVP a full account manager, a profile manager, or a small
launcher surface?

**Answer:** A small launcher surface. The MVP ships:

- a status bar item showing the Current Userdata for that window
- a Userdata Menu opened from that status bar item
- creation of new Managed Userdata roots
- launch-or-focus for an existing known Cursor Userdata
- first-run Cursor sign-in through Cursor's normal flow

It does not mutate auth state, manage Cursor Profiles, integrate with the
sidebar Accounts menu, or close source windows automatically.

## 2. What happens right after install?

**Question:** Does the user need to adopt the default userdata before the
extension is useful?

**Answer:** No. On activation, the extension must resolve the platform Default
Userdata and ensure the registry has a `kind: "default"` entry. If no label has
been chosen, it displays as `Default (default)`. The user can rename it to
`Work`, making the status bar display `Userdata: Work (default)`.

This keeps the product aligned with the requirement that installation plus
normal Cursor authentication is enough to start using it.

## 3. What does "current" mean?

**Question:** Is Current Userdata global, last selected, or per window?

**Answer:** Per window. The status bar item in each Cursor window describes the
Cursor Userdata backing that exact window. If one window was launched with
`Personal` and another with `Work (default)`, their status bar items must differ.

The status bar never reports the target the user last clicked, and it never
inspects Cursor's auth UI to infer identity.

## 4. What exactly is in the status bar?

**Question:** What text should users see?

**Answer:**

- Known default: `Userdata: Work (default)` or `Userdata: Default (default)`
- Known managed userdata: `Userdata: Personal`
- Unknown external userdata: `Userdata: Unmanaged`

The label is intentionally about Cursor Userdata, not Cursor account. A tooltip
can include the resolved kind and path class, but it must not expose tokens or
auth-derived data.

## 5. What happens when the user clicks the status bar item?

**Question:** What is the exact Userdata Menu contract?

**Answer:** The menu is a Quick Pick with this order:

1. Current Userdata first, marked `Current`, non-actionable.
2. Other known Cursor Userdata entries, selectable.
3. `Create New Userdata...` as the final CTA.

VS Code Quick Pick does not need to provide native disabled items for this to be
valid. The implementation can render the current entry with a clear detail and
ignore it if selected, or use a separator plus a non-opening current item. The
behavioral contract is what matters: selecting the current item must not launch
or duplicate anything.

## 6. What if there are no other userdatas yet?

**Question:** Does the menu still open?

**Answer:** Yes. It shows the Current Userdata first and `Create New
Userdata...` last. This makes the empty state actionable without adding a panel
or onboarding page.

## 7. How does creating a new userdata work?

**Question:** What is the minimum creation flow?

**Answer:** Prompt for a Userdata Label, derive a stable id, create a Managed
Userdata data directory under the Userdata Store Root, write the registry entry,
then launch Cursor with that userdata and the current workspace when possible.

Cursor's normal first-run sign-in handles authentication. The extension does not
open browser login links, store credentials, or copy session state.

## 8. Can the user rename entries?

**Question:** Is renaming required for MVP?

**Answer:** Yes, as a Command Palette command at minimum:
`Cursor Userdata: Rename Current Userdata`.

Without rename, the Default Userdata would be stuck as `Default (default)`,
which conflicts with the desired UI shape such as `Work (default)`. Rename does
not affect ids, data directories, or auth state.

## 9. What if the current window is unmanaged?

**Question:** If Cursor is running with an external `--user-data-dir`, can the
MVP adopt it?

**Answer:** No. It displays as `Userdata: Unmanaged` and appears first in the
menu as the Current Userdata, but arbitrary external paths are not adopted in
the MVP. The user can still open any known Managed Userdata or create a new one.

This avoids storing absolute platform-dependent paths.

## 10. How strong is launch-or-focus?

**Question:** What does "do not open a duplicate window" mean technically?

**Answer:** For a selected known Cursor Userdata, the launcher invokes Cursor's
CLI with that userdata root and `--reuse-window`. The matching userdata root is
part of the launch request, so an already-running target userdata should receive
the request instead of creating a second window.

The runtime heartbeat records known running instances and helps the extension
decide what it expects to happen, clean stale state, and produce better errors.
The heartbeat is not the focus primitive by itself; the Cursor CLI is.

If the launcher cannot find a usable Cursor CLI or the CLI fails, the MVP reports
that error. It must not fall back to SQLite/token/session mutation.

## 11. Does selecting the current userdata do anything?

**Question:** Should clicking the current entry reload or focus the same window?

**Answer:** No. The current entry is non-actionable. Reloading the window is not
a userdata boundary, and selecting the current userdata should not disturb the
current workspace or chat state.

## 12. Should switching close the source window?

**Question:** After opening `Personal` from `Work`, should `Work` close?

**Answer:** No. The MVP opens or focuses the target userdata and leaves the
source window alone. Automatic close is a later explicit preference, not default
MVP behavior.

## 13. What workspace gets opened?

**Question:** What gets passed to Cursor when launching another userdata?

**Answer:**

- Single-folder workspace: pass the folder path.
- Saved workspace file: pass the `.code-workspace` file.
- Empty or untitled multi-root workspace: launch the target userdata without a
  workspace.

The MVP should avoid guessing multi-root state because guessing can open an
incomplete workspace in the wrong userdata.

## 14. Are extensions shared?

**Question:** Should each Managed Userdata get its own extension install
directory?

**Answer:** No. The intended MVP behavior is that Managed Userdata roots keep
access to the normal Cursor extensions directory, so the switcher extension and
the user's tooling remain available in newly created userdatas.

Local macOS Cursor validation on 2026-06-06 showed that this works when the CLI
is launched with `--user-data-dir` and without `--extensions-dir`: both default
and custom userdata launches reported the same installed extension list, backed
by `~/.cursor/extensions`.

This is a Cursor-specific empirical finding, not a generic VS Code guarantee.
Before shipping cross-platform, validate Linux and Windows. If either platform
does not share extensions by default, the launcher should pass an explicit
runtime-resolved shared Cursor extensions directory for managed launches.

## 15. What is the cross-platform storage contract?

**Question:** Where do managed roots and the registry live?

**Answer:** Under the Userdata Store Root:

- macOS: `~/Library/Application Support/Cursor Userdata Switcher`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/cursor-userdata-switcher`
- Windows: `%LOCALAPPDATA%\Cursor Userdata Switcher`

Registry entries store ids and relative paths under that root. The Default
Userdata stores no absolute path; it is resolved at runtime.

## 16. What launcher dependency is acceptable?

**Question:** Can the MVP require users to install the `cursor` shell command?

**Answer:** No. The happy path should discover Cursor's bundled CLI from the
running Cursor installation. A `cursor` executable on `PATH` is only a fallback.

If neither is available, show a clear error and stop. Do not attempt auth-state
fallbacks.

## 17. What commands exist in MVP?

**Question:** Which commands should be contributed?

**Answer:**

- `Cursor Userdata: Open With Userdata`
- `Cursor Userdata: Create Userdata`
- `Cursor Userdata: Rename Current Userdata`
- `Cursor Userdata: Show Current Userdata`

The status bar click runs `Open With Userdata`. No Activity Bar view, sidebar
view, or Cursor Accounts menu integration is part of MVP.

## 18. What is the first implementation order?

**Answer:**

1. Scaffold UI-only extension package and activation.
2. Resolve Userdata Store Root and Default Userdata per platform.
3. Implement registry read/write and auto-seed Default Userdata.
4. Detect Current Userdata for the current window.
5. Render status bar item and tooltip.
6. Implement Userdata Menu with current item, other entries, and create CTA.
7. Implement `Rename Current Userdata`.
8. Implement `Create Userdata`.
9. Implement bundled CLI discovery plus PATH fallback.
10. Implement launch-or-focus with `--reuse-window`.
11. Add runtime heartbeat and stale cleanup.
12. Validate macOS behavior, then add Linux/Windows path and launcher tests.
