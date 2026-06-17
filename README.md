# Userdata Switcher

Use multiple Cursor AI subscriptions on the same machine, in parallel.

Open work, personal, and client projects with the right Cursor, VS Code, or
Antigravity IDE identity already signed in. Each userdata keeps its own account, theme,
settings, chat history, and editor state. No sign-out dances or manual auth
cleanup.

![Work and Personal Cursor windows](media/screenshot-cursor-work-personal.png)

## Why Use It

- **Use multiple Cursor subscriptions.** Keep work, personal, and client Cursor
  accounts signed in at the same time.
- **Use different themes in parallel.** Give work, personal, and client windows
  distinct Cursor or VS Code looks.
- **Keep accounts apart.** Separate sign-in, chat history, caches, tabs, and
  extension state.
- **Work in parallel.** Keep separate editor identities ready for different
  projects and clients.
- **Install extensions once.** Managed userdatas reuse the editor's normal
  extension directory.
- **Start familiar.** New userdatas can copy your current settings,
  keybindings, and snippets, then drift independently.

## Install

In Cursor, VS Code, Antigravity IDE, or VS Code Insiders, open the Extensions
view and search for **Userdata Switcher**.

## Quick Start

1. Click the Userdata Switcher status bar item, such as `Work (default)`, or run
   `Userdata Switcher: Open With Userdata`.
2. Choose `Create New Userdata...`.
3. Choose `Start from current settings` to copy your user settings,
   keybindings, and snippets once, or choose `Start empty` for editor defaults.
4. Name the userdata, for example `Personal` or `Client A`.
5. The editor opens a new window for that userdata. Sign in to the account you
   want for that context.

![Open With Userdata menu](media/screenshot-menu.png)

## Deleting a Userdata

If you no longer need a managed userdata, you can delete it:
1. Click the status bar item or run `Userdata Switcher: Open With Userdata`.
2. Choose `Delete Userdata...` (or run `Userdata Switcher: Delete Userdata` directly from the Command Palette).
3. Select the userdata you want to delete.
4. Confirm the prompt to move its files to your system's Trash/Recycle Bin and remove it from the registry.

You cannot delete the userdata of the currently active window or the default editor
userdata. If an editor instance for the target userdata is still running, the
confirmation dialog offers **Quit and delete** (macOS and Linux). Closing a window
is not enough — the extension quits the singleton process before trashing files.
Success is reported only after the instance is gone and the folder is removed.

## What Stays Separate

- **Isolated:** accounts, subscriptions, sessions, chat history, caches, tabs,
  and extension state.
- **Copied once:** theme, settings, keybindings, and snippets.
- **Shared:** extension installs. Project files and `.vscode` settings stay with
  each project.

No token copying, SQLite edits, or background sync. Userdata Switcher relies on
the editor's `--user-data-dir` boundary and a shared `--extensions-dir`.

## When Profiles Are Not Enough

Cursor Profiles can separate themes and settings, but they do not change which
Cursor account or AI subscription the editor is using.

VS Code Profiles are still the right tool when you only need different settings,
keybindings, snippets, or extension sets inside one sign-in. Use Userdata
Switcher when account, chat, cache, or extension state also needs its own
boundary.

For GitHub Copilot in VS Code, start with the built-in account preference flow:
Accounts -> **Manage Extension Account Preferences**. Use Userdata Switcher only
when you need isolation beyond that.

## Supported Editors

- Cursor
- Visual Studio Code
- Visual Studio Code Insiders
- Antigravity IDE

Unsupported VS Code-family forks are not guessed automatically. This extension
runs in the **local desktop UI** and does not activate in Remote SSH, WSL, dev
containers, or other remote extension hosts.

## Troubleshooting

Use `Userdata Switcher: Reveal Current Userdata` to open the current userdata
directory in Finder, Explorer, or your system file manager.

If a launch fails, open the editor Output panel and select `Userdata Switcher`.
The channel records the detected host, storage paths, and launch diagnostics.

## Feedback

Source code is available on
[GitHub](https://github.com/domoarigatomrburato/userdata-switcher).

Report bugs and feature requests on
[GitHub Issues](https://github.com/domoarigatomrburato/userdata-switcher/issues).
