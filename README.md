# Userdata Switcher

**Cursor users:** this is the clean way to use multiple Cursor AI accounts in
the same workspace.

**VS Code users:** GitHub Copilot already supports different accounts per
workspace or profile natively — but you can still use this when Profiles are
not enough (see below).

<!-- Screenshot: Open With Userdata menu with Current label, userdata list, and Actions -->
![Open With Userdata menu](media/screenshot-menu.png)

Open the current project in another named editor identity, such as `Work` or
`Personal`, without copying the repository or touching auth tokens or SQLite
databases.

## When Profiles Are Not Enough

VS Code and Cursor **Profiles** are great for switching settings, themes,
extensions, keybindings, and snippets inside one editor install.

They are **not** a separate editor identity. Profiles live inside a single
userdata root. They do not give you a separate product sign-in boundary on
their own.

Use **Profiles** when you only need different editor configuration.

Use **Userdata Switcher** when you need any of the following:

| You need… | Profiles | Userdata Switcher |
| --- | --- | --- |
| Different themes or extensions | Yes | Overkill |
| Different GitHub Copilot account in VS Code (per workspace/profile) | Yes, natively | Usually unnecessary |
| Different **Cursor** AI account or subscription | No | Yes |
| **Work and Personal open at the same time** on the same repo | No | Yes |
| Full separation of sign-in, chat history, caches, and global editor storage | No | Yes |
| Hard isolation between client or personal editor environments | No | Yes |

### Cursor

Cursor does not currently offer a native way to keep different signed-in Cursor
accounts per workspace or profile. Community guidance still points to signing
out and back in, or launching separate instances with `--user-data-dir`.

Profiles in Cursor can separate themes and settings, but they do **not**
change which Cursor account or subscription the editor is using.

That is the main gap this extension targets.

<!-- Screenshot: two Cursor windows on the same repo — Work (default) and Personal, different themes optional -->
<!-- File: media/screenshot-cursor-work-personal.png -->
![Work and Personal Cursor windows on the same repository](media/screenshot-cursor-work-personal.png)

### VS Code

For **GitHub Copilot**, start with the built-in flow: Accounts → **Manage
Extension Account Preferences** → choose the GitHub account for Copilot in this
workspace or profile.

Reach for Userdata Switcher when you need more than that — for example two
full editor identities running side by side, or isolation that goes beyond
what Profiles and per-extension account preferences provide.

<!-- Screenshot (optional): two VS Code windows side by side when Profiles are not enough -->
<!-- File: media/screenshot-vscode-dual-identities.png -->
![Two VS Code identities on the same workspace](media/screenshot-vscode-dual-identities.png)

## Why This Approach Is Clean

The extension launches supported editors with isolated userdata roots using the
editor's own `--user-data-dir` mechanism.

It does not copy tokens, edit SQLite databases, or rewrite sign-in state. Each
userdata is a normal editor launch in its own storage boundary.

## Install

### Visual Studio Marketplace

Install **Userdata Switcher** from the Visual Studio Marketplace when it is
available there.

### Install from VSIX

1. Download `userdata-switcher-<version>.vsix`.
2. Open the Extensions view in your editor.
3. Choose **Install from VSIX...** from the view menu.
4. Select the file and reload when prompted.

Cursor users can install the VSIX the same way.

## Supported Editors

- Visual Studio Code
- Visual Studio Code Insiders
- Cursor

Unsupported VS Code-family forks are not guessed automatically.

## How To Use

1. Look at the status bar item to see the current userdata for this window.
2. Click it, or run `Userdata Switcher: Open With Userdata`.
3. Create a new userdata, rename the current label, reveal the current userdata
   folder, or open another known userdata.
4. The first time you open a new managed userdata, sign in to the editor or
   product account you want for that context.

The default userdata is the normal editor launch with no `--user-data-dir`.
Managed userdatas are launched with `--user-data-dir`.

<!-- Screenshot: status bar item showing current userdata label (e.g. Work (default)) -->
<!-- File: media/screenshot-status-bar.png -->
![Current userdata in the status bar](media/screenshot-status-bar.png)

## Commands

- `Userdata Switcher: Open With Userdata`
- `Userdata Switcher: Create Userdata`
- `Userdata Switcher: Rename Current Userdata`
- `Userdata Switcher: Show Current Userdata`
- `Userdata Switcher: Reveal Current Userdata`

<!-- Screenshot: Reveal Current Userdata opening the userdata folder in Finder / Explorer -->
<!-- File: media/screenshot-reveal-userdata.png -->
![Reveal Current Userdata in the system file manager](media/screenshot-reveal-userdata.png)

## Where Data Is Stored

Managed userdata is stored separately per supported editor host:

- macOS: `~/Library/Application Support/udsw/<host>`
- Linux: `$XDG_DATA_HOME/udsw/<host>` or `~/.local/share/udsw/<host>`
- Windows: `%LOCALAPPDATA%\udsw\<host>`

Different hosts do not share registries or managed userdata directories.

## What This Is Not

This extension does not modify credentials, sessions, tokens, or product
sign-ins. It does not replace VS Code Profiles, and it does not integrate with
sidebar sign-in controls.

## Diagnostics

If a launch fails, open the editor Output panel and select `Userdata Switcher`.
The channel records the detected host, storage paths, and launch diagnostics.

## Notes

Opening a managed userdata may start or focus another editor window. Existing
chat or editor tabs from another userdata context may not be valid in the newly
opened context.

## Feedback

Report bugs and feature requests on
[GitHub Issues](https://github.com/domoarigatomrburato/userdata-switcher/issues).
