# Existing Tools And Open Questions

Date: 2026-06-06

This note records the external-tool scan and implementation risks discovered
after the pivot from SQLite/session mutation to isolated Cursor Userdata
launching.

## Summary

No existing extension found in the scan matches the current MVP shape:

- Cursor-focused
- cross-platform
- status bar shows the Current Userdata for the exact window
- Quick Pick menu can create/open/focus named managed userdatas
- uses `--user-data-dir`
- does not mutate tokens, SQLite, cookies, or session storage

The closest tools are adjacent, but each solves a different problem or uses a
rejected mechanism.

## Existing Tools Checked

### Cursor Account Switcher

URL:
https://marketplace.visualstudio.com/items?itemName=AliAldahmani.cursor-account-switcher

This is the closest by product name and user intent, but it uses the rejected
approach: save local Cursor session/account snapshots, switch accounts by
restoring those snapshots, and keep backups under `~/.cursor-account-switcher/`.
Its published usage flow asks users to log into one account, add it, log out,
log into another account, and add it.

This project should remain a negative reference, not a design template. It lives
in the same problem space as the archived SQLite spike.

### Cursor Logged User Indicator

URL:
https://marketplace.visualstudio.com/items?itemName=fseitun.cursor-logged-user-indicator

This is a useful status bar precedent, but it is read-only. It reads Cursor's
local `state.vscdb` to display cached account information and warn about
expected accounts. It does not launch alternate userdatas or switch anything.

It also documents the same storage-key fragility that led this project away from
auth-state mutation.

### VSCode Taskbar Separator

URL:
https://marketplace.visualstudio.com/items?itemName=NicolasBirken.vscode-taskbar-separator

This is the closest technical precedent for launching isolated VS Code-family
instances. It is Windows-only and wrapper-based. It adds isolation flags such as
`--user-data-dir`, plus Windows taskbar-specific app model id behavior, for
secondary instances.

It is not a named Cursor Userdata launcher, not cross-platform, and not focused
on Cursor subscription identity. Still, it is worth studying for Windows launch
edge cases and extension sharing/symlink strategy.

### VS Code Profile Extensions

URLs:

- https://marketplace.visualstudio.com/items?itemName=CodingMation.aps-vscode
- https://marketplace.visualstudio.com/items?itemName=cyberbiont.vscode-profiles
- https://marketplace.visualstudio.com/items?itemName=aaronpowell.vscode-profile-switcher

These tools manage settings, themes, extension sets, or VS Code profile-like
configuration. They do not isolate full editor userdata identity.

The deprecated Profile Switcher also reinforces the terminology problem:
`Profile` is already claimed by VS Code/Cursor configuration profiles and should
not be used for this product's identity-isolating concept.

### VS Code Built-In Profiles

URL:
https://code.visualstudio.com/docs/configure/profiles

VS Code's built-in profiles can be associated with folders/workspaces and can
be opened from the command line with `--profile`. They manage editor
configuration, not a separate userdata root. They are not sufficient for Cursor
subscription identity isolation.

### Cursor Community Workarounds

URLs:

- https://forum.cursor.com/t/cross-account-memory-and-repo-data-persist-after-logout-local-device/144906/2
- https://forum.cursor.com/t/two-account-one-user-how/63960/18
- https://forum.cursor.com/t/seamless-account-switching-in-cursor/58411?page=2

Cursor community posts already point users at manual `--user-data-dir`
shortcuts for separate accounts. The feature-request thread shows active demand
for account-per-workspace/account switching.

This supports the product direction: make the known workaround ergonomic,
named, visible per window, and cross-platform.

## Generic VS Code Applicability

The current architecture is mostly VS Code-family generic under the hood:

- status bar item
- Quick Pick menu
- registry outside editor userdata
- `--user-data-dir` launch
- `--reuse-window` launch-or-focus attempt
- per-window Current Userdata detection

Cursor-specific pieces should be isolated behind an adapter:

- product naming
- default userdata path
- managed store root name
- bundled CLI discovery
- default extension directory behavior
- UI labels using `Cursor Userdata`

Recommendation: implement the MVP as Cursor-only product scope, but keep a
small internal adapter boundary so a VS Code adapter would be possible later.

## Extension Sharing Finding

Public VS Code CLI documentation says that instances launched with different
`--user-data-dir` values have separate installed extensions and may require
extension reinstall:

https://code.visualstudio.com/docs/configure/command-line

Local macOS Cursor validation on 2026-06-06 showed different behavior for this
Cursor installation. Both commands listed the same extensions:

```text
ELECTRON_RUN_AS_NODE=1 /Applications/Cursor.app/Contents/MacOS/Cursor \
  /Applications/Cursor.app/Contents/Resources/app/out/cli.js \
  --list-extensions

ELECTRON_RUN_AS_NODE=1 /Applications/Cursor.app/Contents/MacOS/Cursor \
  /Applications/Cursor.app/Contents/Resources/app/out/cli.js \
  --user-data-dir /tmp/cursor-uds-extension-check \
  --list-extensions
```

Both printed:

```text
anysphere.remote-containers
anysphere.remote-ssh
bierner.markdown-preview-github-styles
hearth-code.hearth-theme
mhutchie.git-graph
```

The local extension directory found was:

```text
~/.cursor/extensions
```

Interpretation: on this macOS Cursor build, omitting `--extensions-dir` while
passing custom `--user-data-dir` appears to preserve access to the shared Cursor
extensions directory.

This must be validated on Linux and Windows. If Cursor differs by platform, the
launcher should resolve and pass an explicit shared Cursor extensions directory
for managed launches. The MVP should not require users to manually reinstall the
switcher extension in every new Cursor Userdata.

## Open Questions For Review

1. Is launch-or-focus with `--reuse-window` scoped strongly enough by
   `--user-data-dir` to avoid duplicate windows for already-running managed
   userdatas on macOS, Linux, and Windows?
2. Should the heartbeat be only diagnostic/stale-state metadata, or should it
   actively influence launch decisions?
3. Is Current Userdata detection via `context.globalStorageUri.fsPath` reliable
   for both Default Userdata and managed custom roots?
4. Does a new managed Cursor Userdata actually activate the switcher extension
   after UI launch, not only show it in `--list-extensions`?
5. Should the implementation pass an explicit `--extensions-dir` even on macOS
   for consistency, or leave it omitted where Cursor already shares extensions?
6. Can bundled CLI discovery be made robust across Cursor stable/nightly/lab and
   across macOS, Linux, and Windows without requiring shell integration?
7. Should the first implementation support only single-folder and saved
   workspace-file reopening, leaving untitled multi-root workspaces as
   launch-without-workspace?
8. Should the MVP include delete/remove userdata, or defer it to avoid accidental
   data loss?

## Recommended Next Step

Build a minimal Cursor-only extension with a clean internal adapter boundary.
Before adding polish, validate these three runtime facts:

1. Status bar Current Userdata detection is correct per window.
2. Launch-or-focus does not duplicate windows for already-running userdatas.
3. New managed userdatas can see and activate the switcher extension without
   manual reinstall.
