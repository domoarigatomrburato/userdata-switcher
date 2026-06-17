# Userdata Switcher

Glossary for a local VS Code-family extension and launcher that opens a
supported editor with named, isolated userdata roots.

## Language

**Editor Host**:
A supported VS Code-family desktop application that can run this extension and
be launched with a userdata root, such as Cursor, Visual Studio Code, Visual
Studio Code Insiders, or Antigravity IDE.
_Avoid_: arbitrary fork, guessed host

**Editor Userdata**:
A named, isolated editor data root for one intended sign-in or configuration
context, such as "Work" or "Personal".
_Avoid_: Profile, Saved Sign-In

**Supported Host**:
An Editor Host with explicit path and CLI behavior known to this tool.
_Avoid_: guessed fork, best-effort host

**Managed Userdata**:
An Editor Userdata registered and named by this tool.
_Avoid_: preset, profile, sign-in preset

**Unmanaged Userdata**:
The userdata used by the current window when it is not yet known to this tool.
_Avoid_: invalid profile, unknown sign-in

**Default Userdata**:
The vanilla no-flag userdata used when an Editor Host is launched normally. It
exists without user setup. In UI, show it as `<label> (default)`, for example
`Work (default)`.
_Avoid_: Default profile, built-in profile

**Userdata Label**:
The user-facing name assigned to an Editor Userdata, such as `Work`,
`Personal`, or `Client A`.
_Avoid_: email address, profile name

**Userdata Registry**:
The tool-owned record of Managed Userdata entries, labels, and launcher
preferences for one Supported Host.
_Avoid_: Extension globalState, editor profile settings

**Userdata Store Root**:
The platform-specific app data location where this tool stores its registry and
automatically created Managed Userdata for one Supported Host.
_Avoid_: hard-coded absolute path, extension globalStorage

**Open With Userdata**:
Open or focus the current Editor Host using a selected known Userdata, usually
for the current workspace.
_Avoid_: apply sign-in, reload window

**Userdata Menu**:
The status-bar menu whose title shows the Current Userdata and whose items list
other known Userdata choices plus actions such as renaming the Current Userdata
or creating a new Userdata.
_Avoid_: sign-in menu, profile selector

**Running Userdata Instance**:
A live editor window or process associated with an Editor Userdata. On macOS and
Linux, Userdata Switcher detects a running instance by connecting to the editor
IPC socket (`1.12-main.sock`) under the userdata root before deleting managed
userdata.
_Avoid_: Running profile, active sign-in

**Current Userdata**:
The Editor Userdata used by a specific currently running editor window.
_Avoid_: active sign-in, current profile

**Userdata Boundary**:
The process/data boundary that makes an editor process belong to one Editor
Userdata until it exits.
_Avoid_: Reload Window, live switch

**Launcher Helper**:
A local helper invoked by the extension to start the current Editor Host with
the selected Editor Userdata.
_Avoid_: profile switcher, sign-in switcher

**Shared Extensions Directory**:
The normal extension install location used by an Editor Host outside its
userdata root.
_Avoid_: Profile extensions, sign-in extensions

**First-Run Sign-In**:
The normal editor or product login performed the first time a new Userdata is
opened.
_Avoid_: setup automation, credential management

**Editor Profile**:
A VS Code-family profile feature for settings, keybindings, snippets, and
extension configuration. It is not an Editor Userdata boundary.
_Avoid as synonym for_: Editor Userdata
