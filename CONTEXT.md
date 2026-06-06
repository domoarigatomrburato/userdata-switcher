# Cursor Userdata Switcher

Glossary for a local Cursor extension and launcher that opens Cursor with named,
isolated userdata roots.

## Language

**Cursor Userdata**:
A named, isolated Cursor data root for one intended sign-in context, such as
"Work" or "Personal".
_Avoid_: Profile, Account, Saved Account, session

**Managed Userdata**:
A Cursor Userdata registered and named by this tool.
_Avoid_: Saved Account, preset, profile

**Unmanaged Userdata**:
The Cursor userdata used by the current window when it is not yet known to this
tool.
_Avoid_: Unknown account, invalid profile

**Default Userdata**:
The vanilla Cursor userdata used when Cursor is launched normally. It exists
without user setup. In UI, show it as `<label> (default)`, for example
`Work (default)`.
_Avoid_: Default profile, built-in profile

**Userdata Label**:
The user-facing name assigned to a Cursor Userdata, such as `Work`,
`Personal`, or `Client A`.
_Avoid_: account email, token name, profile name

**Userdata Registry**:
The tool-owned record of Managed Userdata entries, labels, and launcher
preferences.
_Avoid_: Extension globalState, Cursor profile settings

**Userdata Store Root**:
The platform-specific app data location where this tool stores its registry and
automatically created Managed Userdata.
_Avoid_: hard-coded absolute path, extension globalStorage

**Open With Userdata**:
Open or focus Cursor using a selected Managed Userdata, usually for the current
workspace.
_Avoid_: Switch account, apply account, login

**Userdata Menu**:
The status-bar menu that shows the Current Userdata first, other known
Cursor Userdata choices, and actions such as creating a new Cursor Userdata.
_Avoid_: account menu, profile selector

**Running Userdata Instance**:
A live Cursor window or process associated with a Cursor Userdata.
_Avoid_: Running profile, active account

**Current Userdata**:
The Cursor Userdata used by a specific currently running Cursor window.
_Avoid_: Active Account, current profile

**Userdata Boundary**:
The process/data boundary that makes a Cursor process belong to one Cursor
Userdata until it exits.
_Avoid_: Reload Window, hot-swap

**Launcher Helper**:
A local helper invoked by the extension to start Cursor with the selected Cursor
Userdata.
_Avoid_: DB switcher, token helper

**Shared Extensions Directory**:
The normal Cursor extension install location shared by Cursor Userdata roots.
_Avoid_: Cursor Profile, account extensions

**First-Run Sign-In**:
The normal Cursor login performed the first time a new Cursor Userdata is opened.
_Avoid_: Token repair, login-link, browser PKCE

**Cursor Profile**:
Cursor's built-in profile feature for settings, keybindings, snippets, and
extension configuration. It does not isolate Cursor subscription identity.
_Avoid as synonym for_: Cursor Userdata

**Cursor Accounts Menu**:
The sidebar accounts menu backed by VS Code's Authentication API for extension
auth providers. It is not Cursor subscription identity.
_Avoid as synonym for_: Cursor Userdata, Cursor sign-in

**Archived SQLite Spike**:
The research under `spike/` that tested auth-slice and full-DB mutation.
_Avoid_: production path, recovery path, alternate implementation
