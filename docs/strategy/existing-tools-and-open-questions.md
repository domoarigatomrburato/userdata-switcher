# Existing Tools And Open Questions

Date: 2026-06-06

This note records adjacent tools and unresolved validation questions for
Userdata Switcher.

## Summary

No checked tool matched the MVP shape exactly:

- host-neutral VS Code-family support
- status bar shows the Current Userdata for the exact window
- Quick Pick menu can create/open/focus named managed userdatas
- launches with `--user-data-dir`
- keeps one registry per Supported Host

Adjacent tools generally manage editor Profiles, extension sets, or platform
shortcuts. Those are different from a named userdata root boundary.

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

## Source Of Truth

- Architecture and supported-host boundary: `docs/adr/0001-use-supported-editor-userdata-roots.md`
- Product behavior and MVP acceptance shape: `docs/strategy/mvp-contract.md`
- Domain vocabulary: `CONTEXT.md`

## Open Questions For Review

1. Does the switcher extension activate in a new managed userdata after UI
   launch in every Supported Host?
2. Is `context.globalStorageUri.fsPath` reliable inside a real extension host on
   all supported platforms?
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
- Managed launches pass an explicit shared `--extensions-dir` when the Supported
  Host adapter resolves a Shared Extensions Directory. The adapter owns the
  per-host path; the generic launcher owns when the flag is added.
