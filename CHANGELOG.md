# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.4.1

### Changed

- Bundle the extension runtime into a single minified file for published VSIX
packages.
- Local extension debugging keeps an unminified build with source maps.

## 1.4.0

### Added

- Default keybinding for **Open Userdata in New Window** (`Cmd+Shift+U` on macOS,
`Ctrl+Shift+U` elsewhere).
- **Open Output** action on launch failure dialogs.

### Changed

- Userdata menu reworked for **Open Userdata in New Window**: the current window
is pinned as a header, other userdatas show **running** or **idle**, and
rename, reveal, and delete sit behind **Manage userdatas...** for any
registered userdata.
- Delete confirmation uses the same modal information dialog as userdata
creation.
- Command palette entry renamed to **Open Userdata in New Window**
(`userdataSwitcher.openInNewWindow`).
- README updated for the new menu layout and flows.

### Removed

- Command id `userdataSwitcher.openWithUserdata`. Rebind custom keybindings to
`userdataSwitcher.openInNewWindow`.

## 1.3.4

### Changed

- Release CI publishes GitHub releases and VSIX assets from version tags.

## 1.3.3

### Changed

- README: document delete userdata and the new initialization dialog, with
updated screenshots.

## 1.3.2

No user-facing extension changes in this release.

## 1.3.1

### Fixed

- Create userdata flow: ask for the label first, then choose initialization mode
via a modal dialog instead of a searchable quick pick.

### Changed

- Update transitive dev dependencies for published security advisories (`undici`,
`form-data`).

## 1.3.0

### Added

- Managed userdata deletion from the userdata menu and Command Palette, moving
files to the system trash and removing the registry entry (thanks
[@tazztone](https://github.com/tazztone)).
- Running-instance preflight on macOS and Linux via the editor IPC socket, and on
Windows via matching editor processes for the target `--user-data-dir`.
- **Quit and delete** action that terminates the stray editor process
(SIGTERM, then SIGKILL) when closing the window did not quit the singleton
instance. A single confirmation adapts when a running instance is detected;
success is reported only after quit and folder removal are verified.

## 1.2.0

### Added

- Antigravity IDE as a supported editor host, including path resolution, CLI
discovery, and managed userdata launches (thanks [@tazztone](https://github.com/tazztone)).

## 1.1.1

### Changed

- Exclude README screenshots from the VSIX to shrink the package; `vsce` still
rewrites image links for Marketplace and the installed extension readme.

## 1.1.0

### Changed

- Raise the VS Code engine floor to `^1.90.0`, remove the non-idiomatic
`engines.node` field, and align `@types/vscode` / `@types/node` with that
minimum while keeping compatibility with Cursor's declared API.
- Upgrade GitHub Actions to `actions/checkout@v6` and `actions/setup-node@v6` to
clear Node 20 deprecation warnings.

### Fixed

- Add an SVG `<title>` so Biome's accessibility check passes in CI.

## 1.0.6

### Changed

- Reload the Userdata Registry for Current Userdata reads so multiple windows do
not show stale labels after another window updates the registry.
- Split activation orchestration into app, registry store, host session, and
managed userdata provisioning modules.
- Make `npm run check` readonly and add `npm run fix` for safe Knip and Biome
autofixes.

## 1.0.5

### Fixed

- Launch Windows `.cmd` editor shims through `cmd.exe /d /c call` so paths under
`Program Files` work correctly.
- Detect managed Windows userdatas when drive-letter casing differs between
VS Code and the registry.
- Discover `Code.exe` above versioned VS Code app roots before falling back to
PATH.

## 1.0.4

### Fixed

- Quote Windows `.cmd` editor shim paths when launching through `cmd.exe` so
installations under `Program Files` launch correctly.

## 1.0.3

### Fixed

- Avoid spawning Windows `.cmd` editor shims directly, which could fail with
`spawn EINVAL`.
- Prefer the Windows editor executable over the CLI shim when both are
available.

## 1.0.2

### Fixed

- Add Windows editor discovery diagnostics to the Output panel.
- Fall back to the Windows editor executable when the bundled CLI shim is not
available.

## 1.0.1

### Fixed

- Updated the locked `esbuild` development dependency to resolve npm audit
advisories before publishing.

## 1.0.0

### Added

- Open separate Cursor or VS Code userdatas side by side, each with isolated
account, subscription, chat history, cache, tab, and extension state.
- Create new userdatas from current settings, keybindings, snippets, and theme,
then let them drift independently.
- `Reveal Current Userdata` command and menu action to open the current userdata
directory in the system file manager.
- GitHub Actions CI for check, test, build, VSIX packaging, and packaging
verification.

### Changed

- README is now Marketplace-focused, with a clearer explanation of Cursor AI
subscriptions, VS Code themes, Profiles, and userdata isolation.
- Marketplace metadata: description, keywords, screenshots, and Q&A routing.
- VSIX packaging excludes CI workflow files, contributing docs, and build
config.

## 0.2.0

### Added

- Compact status bar and clearer Userdata Menu actions.
- Command categories for cleaner Command Palette grouping.
- Typed menu intent handling internally.
- Package metadata and Marketplace-ready README assets.

## 0.1.2

### Added

- Named userdata launch flows for supported VS Code-family editors.
- Current userdata detection for the active window.
- Managed userdata creation and rename flows.
- Shared extensions directory handling for managed userdata launches.

