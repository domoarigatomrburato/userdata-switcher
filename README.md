# Userdata Switcher

Open the same workspace in separate Cursor or VS Code identities, each with its
own account, settings, chat history, and editor state.

Use it when you want Work, Personal, or Client A side by side without copying
the repo, signing in and out, or touching auth storage.

![Work and Personal Cursor windows on the same repository](media/screenshot-cursor-work-personal.png)

## Why Use It

- **Separate editor identities.** Keep sign-in, chat history, caches, tabs, and
  extension state isolated per userdata.
- **Same project, multiple windows.** Open the same repo as Work and Personal at
  the same time.
- **Shared extension installs.** Install tools once; managed userdatas reuse the
  editor's normal extension directory.
- **Comfortable first run.** New userdatas can start from your current settings,
  keybindings, and snippets, then drift independently.

## Quick Start

1. Click the Userdata Switcher status bar item, such as `Work (default)`, or run
   `Userdata Switcher: Open With Userdata`.
2. Choose `Create New Userdata...`.
3. Choose `Start from current settings` to copy your user settings,
   keybindings, and snippets once, or choose `Start empty` for editor defaults.
4. Name the userdata, for example `Personal` or `Client A`.
5. The editor opens a new window for that userdata. Sign in to the account you
   want for that context.

![Current userdata in the status bar](media/screenshot-status-bar.png)

![Open With Userdata menu](media/screenshot-menu.png)

## What Changes Between Userdatas

| Data | Behavior |
| --- | --- |
| Accounts, sessions, chat history, caches, tabs, extension state | Isolated per userdata |
| User settings, keybindings, snippets | Copied once by default, then independent |
| Extension installations | Shared from the editor's normal extension directory |
| Workspace files and `.vscode` workspace settings | Shared because they belong to the repo |

Userdata Switcher does not copy tokens, edit SQLite databases, rewrite sign-in
state, or sync settings in the background. It uses the editor's own
`--user-data-dir` boundary and launches managed userdatas with a shared
`--extensions-dir`.

## Cursor Accounts

Cursor Profiles can separate themes and settings, but they do not change which
Cursor account or subscription the editor is using. Userdata Switcher creates a
separate editor data root, so each Cursor userdata can sign in to a different
account.

## VS Code Profiles

VS Code Profiles are still the right tool when you only need different settings,
keybindings, snippets, or extension sets inside one sign-in.

Reach for Userdata Switcher when you need a stronger boundary: separate
sign-ins, chat history, caches, extension state, or two full editor identities
running side by side.

For GitHub Copilot in VS Code, start with the built-in account preference flow:
Accounts -> **Manage Extension Account Preferences**. Use Userdata Switcher only
when you need isolation beyond that.

![Two VS Code identities on the same workspace](media/screenshot-vscode-dual-identities.png)

## Supported Editors

- Cursor
- Visual Studio Code
- Visual Studio Code Insiders

Unsupported VS Code-family forks are not guessed automatically.

This extension runs in the **local desktop UI**. It does not activate in Remote
SSH, WSL, dev containers, or other remote extension hosts.

## Commands

- `Userdata Switcher: Open With Userdata`
- `Userdata Switcher: Create Userdata`
- `Userdata Switcher: Rename Current Userdata`
- `Userdata Switcher: Show Current Userdata`
- `Userdata Switcher: Reveal Current Userdata`

## Install

### Visual Studio Marketplace

In VS Code, open the Extensions view and search for **Userdata Switcher**.

### Install From VSIX

Use this for Cursor, local testing, or manual installs:

1. Download `userdata-switcher-<version>.vsix` from
   [GitHub Releases](https://github.com/domoarigatomrburato/userdata-switcher/releases),
   or build it locally with `npm run package:vsix`.
2. Open the Extensions view.
3. Open the view menu (`...`) and choose **Install from VSIX...**.
4. Select the file and reload when prompted.

## Reveal And Diagnostics

Use `Userdata Switcher: Reveal Current Userdata` to open the current userdata
directory in Finder, Explorer, or your system file manager.

![Reveal Current Userdata in the system file manager](media/screenshot-reveal-userdata.png)

If a launch fails, open the editor Output panel and select `Userdata Switcher`.
The channel records the detected host, storage paths, and launch diagnostics.

Common failures:

- **Editor CLI not found**: the extension could not locate the bundled or `PATH`
  CLI for this host (`cursor`, `code`, or `code-insiders`).
- **Managed path too long on macOS**: the userdata path exceeds the Unix socket
  path limit. Try a shorter label or a shorter home directory path.
- **Unmanaged userdata**: the current window was opened with a userdata root not
  registered by this extension. You can still open other userdatas and reveal
  the current folder, but rename is unavailable until the window matches a known
  entry.

## Storage

Managed userdata is stored separately per supported editor host:

- macOS: `~/Library/Application Support/udsw/<host>`
- Linux: `$XDG_DATA_HOME/udsw/<host>` or `~/.local/share/udsw/<host>`
- Windows: `%LOCALAPPDATA%\udsw\<host>`

Different hosts do not share registries or managed userdata directories.

## Notes

- Opening a managed userdata spawns the editor CLI and may open a new window or
  focus an existing one for that userdata, depending on the editor.
- From a multi-root window with no saved `.code-workspace` file, the launch
  opens the editor without a workspace path. Save the workspace first, or open
  from a single-folder window, if you need the project loaded automatically.
- Userdata Switcher does not replace VS Code Profiles and does not integrate
  with sidebar sign-in controls.

## Feedback

Report bugs and feature requests on
[GitHub Issues](https://github.com/domoarigatomrburato/userdata-switcher/issues).
