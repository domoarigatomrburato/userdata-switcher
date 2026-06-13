# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
