# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
