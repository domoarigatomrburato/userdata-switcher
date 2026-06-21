# Userdata Switcher

Use multiple Cursor AI subscriptions on the same machine, in parallel.

Open work, personal, and client projects with the right Cursor, VS Code, or
Antigravity IDE identity already signed in. Each userdata keeps its own account,
theme, settings, chat history, and editor state — no sign-out dances or manual
auth cleanup.

![Work and Personal Cursor windows](media/screenshot-cursor-work-personal.png)

## Why Use It

- **Use multiple Cursor subscriptions.** Keep work, personal, and client Cursor
  accounts signed in at the same time.
- **Use different themes in parallel.** Give each window its own look.
- **Keep accounts apart.** Separate sign-in, chat history, caches, tabs, and
  extension state.
- **Install extensions once.** Managed userdatas reuse the editor's normal
  extension directory.
- **Start familiar.** New userdatas can copy your current settings,
  keybindings, and snippets once, then drift independently.

## Install

In Cursor, VS Code, Antigravity IDE, or VS Code Insiders, open the Extensions
view and search for **Userdata Switcher**.

## The Menu

Click the status bar item (for example `Work (default)`), or run
**Userdata Switcher: Open Userdata in New Window** (`Cmd+Shift+U` on macOS,
`Ctrl+Shift+U` elsewhere).

The picker shows:

- **Current window** — which userdata this window is using (not a launch target).
- **Other userdatas** — open any of them in a new window. Each row shows
  `running` or `idle`.
- **Create new userdata...** — add another named userdata.
- **Manage userdatas...** — rename, reveal, or delete any registered userdata.

## Quick Start

**Open another userdata in parallel**

1. Open the menu.
2. Pick a userdata from the list. A new window opens with that identity.
3. Sign in there if needed.

**Create your first extra userdata**

1. Open the menu and choose `Create new userdata...`.
2. Name it, for example `Personal` or `Client A`.
3. Choose `Start from current settings` to copy user settings, keybindings, and
   snippets once, or `Start empty` for editor defaults.

4. A new window opens for that userdata. Sign in to the account you want for
   that context.

## Manage Userdatas

From the menu, choose `Manage userdatas...`, pick a userdata, then:

- **Rename...** — change its label.
- **Reveal...** — open its folder in Finder, Explorer, or your file manager.
- **Delete userdata...** — move its files to Trash/Recycle Bin and remove it
  from the registry.

You can also run **Userdata Switcher: Delete Userdata** from the Command Palette
to delete without going through the manage submenu.

You cannot delete the userdata of the current window or the default editor
userdata. If an instance for the target userdata is still running, the
confirmation offers **Quit and delete**. Closing a window is not enough — the
extension quits the singleton process before trashing files.

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

VS Code Profiles fit when you only need different settings, keybindings,
snippets, or extension sets inside one sign-in. Use Userdata Switcher when
account, chat, cache, or extension state also needs its own boundary.

For GitHub Copilot in VS Code, start with Accounts → **Manage Extension Account
Preferences**. Use Userdata Switcher only when you need isolation beyond that.

## Supported Editors

- Cursor
- Visual Studio Code
- Visual Studio Code Insiders
- Antigravity IDE

Unsupported VS Code-family forks are not guessed automatically. This extension
runs in the **local desktop UI** and does not activate in Remote SSH, WSL, dev
containers, or other remote extension hosts.

## Troubleshooting

- **Reveal the current window's folder:** run **Userdata Switcher: Reveal
  Current Userdata**, or use **Reveal...** in the manage menu for any userdata.
- **Launch failed:** use **Open Output** on the error dialog, or open the Output
  panel and select `Userdata Switcher` for host, path, and launch diagnostics.

## Feedback

Source code is available on
[GitHub](https://github.com/domoarigatomrburato/userdata-switcher).

Report bugs and feature requests on
[GitHub Issues](https://github.com/domoarigatomrburato/userdata-switcher/issues).
