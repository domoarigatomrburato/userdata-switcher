# Userdata Switcher MVP Self-Grill

This simulated `grill-with-docs` pass records the current MVP decisions.

## 1. What must the MVP ship?

**Question:** Is the MVP a full account manager, a profile manager, or a small
launcher surface?

**Answer:** A small launcher surface. The MVP ships:

- a status bar item showing the Current Userdata for that window
- a Userdata Menu opened from that status bar item
- creation of new Managed Userdata roots
- launch for an existing known Userdata with the correct `--user-data-dir`
- first-run sign-in or setup through the current Editor Host's normal flow

It does not manage editor Profiles, integrate with sidebar Accounts menus, or
close source windows automatically.

## 2. What happens right after install?

**Question:** Does the user need to adopt the default userdata before the
extension is useful?

**Answer:** No. On activation, the extension resolves the platform Default
Userdata for the current Supported Host and ensures the registry has a
`kind: "default"` entry. If no label has been chosen, it displays as
`Default (default)`. The user can rename it to `Work`, making the status bar
display `Userdata: Work (default)`.

## 3. What does "current" mean?

**Question:** Is Current Userdata global, last selected, or per window?

**Answer:** Per window. The status bar item in each editor window describes the
Userdata backing that exact window. If one window was launched with `Personal`
and another with `Work (default)`, their status bar items must differ.

The status bar never reports the target the user last clicked.

## 4. What exactly is in the status bar?

**Question:** What text should users see?

**Answer:**

- Known default: `Userdata: Work (default)` or `Userdata: Default (default)`
- Known managed userdata: `Userdata: Personal`
- Unknown external userdata: `Userdata: Unmanaged`

The label is intentionally about Userdata. A tooltip can include the current
Editor Host name and resolved kind.

## 5. What happens when the user clicks the status bar item?

**Question:** What is the exact Userdata Menu contract?

**Answer:** The menu is a Quick Pick with this shape:

1. Current Userdata shown in the title.
2. Other known Userdata entries, selectable.
3. `Create New Userdata...` as the final CTA.

The current userdata is not rendered as a selectable item because that proved
confusing in manual UX testing. The menu must not offer an action that relaunches
or duplicates the current userdata.

## 6. What if there are no other userdatas yet?

**Question:** Does the menu still open?

**Answer:** Yes. It shows the Current Userdata in the title and
`Create New Userdata...` as the action.

## 7. How does creating a new userdata work?

**Question:** What is the minimum creation flow?

**Answer:** Prompt for a Userdata Label, derive a stable id, create a Managed
Userdata data directory under the Userdata Store Root, write the registry entry,
then launch the current Editor Host with that userdata and the current workspace
when possible.

## 8. Can the user rename entries?

**Question:** Is renaming required for MVP?

**Answer:** Yes, as a Command Palette command at minimum:
`Userdata Switcher: Rename Current Userdata`.

Without rename, the Default Userdata would be stuck as `Default (default)`.
Rename does not affect ids or data directories.

## 9. What if the current window is unmanaged?

**Question:** If the editor is running with an external `--user-data-dir`, can
the MVP adopt it?

**Answer:** No. It displays as `Userdata: Unmanaged` and appears in the menu
title as the Current Userdata, but arbitrary external paths are not adopted in
the MVP. The user can still open any known Managed Userdata or create a new one.

This avoids storing absolute platform-dependent paths.

## 10. How strong is launch behavior?

**Question:** What must the launcher guarantee?

**Answer:** The MVP must launch the current Supported Host with the selected
userdata root and the current workspace when known. That launch correctness is
the hard requirement.

For Managed Userdata:

```text
<host-cli> --user-data-dir <managed-data-dir> <workspace?>
```

For Default Userdata, omit `--user-data-dir`.

`--reuse-window` is optional. The launcher must never call `--reuse-window`
without `--user-data-dir`, because default-host reuse can hijack the active
window.

No runtime heartbeat is required for MVP. If the launcher cannot find a usable
host CLI or the CLI fails, the MVP reports that error.

## 11. Is the current userdata selectable?

**Question:** Should the menu render the current userdata as a selectable item?

**Answer:** No. The current userdata is shown in the Quick Pick title, not as an
item. Reloading the window is not a userdata boundary, and the menu should not
offer an action that disturbs the current workspace.

## 12. Should switching close the source window?

**Question:** After opening `Personal` from `Work`, should `Work` close?

**Answer:** No. The MVP opens or focuses the target userdata and leaves the
source window alone. Automatic close is a later explicit preference, not default
MVP behavior.

## 13. What workspace gets opened?

**Question:** What gets passed to the host CLI when launching another userdata?

**Answer:**

- Single-folder workspace: pass the folder path.
- Saved workspace file: pass the `.code-workspace` file.
- Empty or untitled multi-root workspace: launch the target userdata without a
  workspace.

The MVP avoids guessing multi-root state because guessing can open an incomplete
workspace in the wrong userdata.

## 14. Are extensions shared?

**Question:** Should each Managed Userdata get its own extension install
directory?

**Answer:** The intended MVP behavior is that Managed Userdata roots keep access
to the normal extension directory for the current Supported Host. If a host does
not share extensions by default, the launcher should pass an explicit
runtime-resolved shared extensions directory for managed launches.

## 15. What is the cross-platform storage contract?

**Question:** Where do managed roots and the registry live?

**Answer:** Under the Userdata Store Root:

- macOS: `~/Library/Application Support/Userdata Switcher/<host>`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/userdata-switcher/<host>`
- Windows: `%LOCALAPPDATA%\Userdata Switcher\<host>`

Registry entries store ids and relative paths under that root. The Default
Userdata stores no absolute path; it is resolved at runtime.

## 16. What launcher dependency is acceptable?

**Question:** Can the MVP require users to install the host shell command?

**Answer:** No. The happy path discovers the bundled CLI from the running Editor
Host installation. A host executable on `PATH` is only a fallback.

If neither is available, show a clear error and stop.

## 17. What commands exist in MVP?

**Question:** Which commands should be contributed?

**Answer:**

- `Userdata Switcher: Open With Userdata`
- `Userdata Switcher: Create Userdata`
- `Userdata Switcher: Rename Current Userdata`
- `Userdata Switcher: Show Current Userdata`

The status bar click runs `Open With Userdata`. No Activity Bar view or sidebar
view is part of MVP.
