# Existing Tools And Open Questions

Date: 2026-06-06

This note records the current product risks for Userdata Switcher.

## Summary

No checked extension matched the MVP shape exactly:

- host-neutral VS Code-family support
- status bar shows the Current Userdata for the exact window
- Quick Pick menu can create/open/focus named managed userdatas
- launches with `--user-data-dir`
- keeps one registry per Supported Host

Adjacent tools generally manage editor Profiles, extension sets, or platform
shortcuts. Those are different from a full userdata root boundary.

## Relevant Adjacent Tools

### VS Code Built-In Profiles

URL:
https://code.visualstudio.com/docs/configure/profiles

Built-in profiles manage settings, keybindings, snippets, tasks, and extension
state. They can be selected from the command line with `--profile`, but they are
not a separate userdata root. This product should keep using `Userdata`, not
`Profile`, for the root-isolating concept.

### Profile Extensions

Examples:

- https://marketplace.visualstudio.com/items?itemName=CodingMation.aps-vscode
- https://marketplace.visualstudio.com/items?itemName=cyberbiont.vscode-profiles
- https://marketplace.visualstudio.com/items?itemName=aaronpowell.vscode-profile-switcher

These tools manage settings, themes, extension sets, or profile-like
configuration. They do not provide the MVP contract of launching a Supported
Host with a named userdata root and showing the Current Userdata per window.

### Secondary-Instance Launchers

Example:
https://marketplace.visualstudio.com/items?itemName=NicolasBirken.vscode-taskbar-separator

These tools are useful precedents for platform launch details, especially on
Windows, but they are not a cross-platform named Userdata registry and launcher.

## Host-Neutral Applicability

The architecture is VS Code-family generic under the hood:

- status bar item
- Quick Pick menu
- registry outside editor userdata
- `--user-data-dir` launch
- optional `--reuse-window` duplicate-avoidance within the target userdata
- per-window Current Userdata detection

Host-specific pieces are isolated behind an adapter:

- display name
- default userdata path
- managed store namespace
- CLI executable names
- bundled CLI discovery
- default extension directory behavior

The MVP product scope is host-neutral Userdata Switcher with explicit support
for Cursor, Visual Studio Code, and Visual Studio Code Insiders. Unsupported
VS Code-family forks should not be guessed until their paths and launch behavior
are validated.

## Open Questions For Review

1. Does the switcher extension activate in a new managed userdata after UI
   launch in every Supported Host?
2. Is `context.globalStorageUri.fsPath` reliable inside a real extension host on
   all supported platforms?
3. Should managed launches pass an explicit shared `--extensions-dir`, or should
   that remain host-specific based on validation?
4. Can bundled CLI discovery be made robust across macOS, Linux, and Windows
   without requiring shell integration?
5. Should the first implementation support only single-folder and saved
   workspace-file reopening, leaving untitled multi-root workspaces as
   launch-without-workspace?
6. Should the MVP include delete/remove userdata, or defer it to avoid
   accidental data loss?

Resolved for MVP planning:

- Runtime heartbeat is not required.
- Launch-or-focus is optional; plain launch with `--user-data-dir` is the hard
  requirement.
